use crate::collection_log::COLLECTION_LOG_DATA;
use crate::config::Config;
use crate::db;
use crate::error::ApiError;
use crate::models::{
    CaptchaVerifyResponse, CreateGroup, GEPrices, WikiGEPrices,
    WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION,
    JagexHiscoreActivityEntry, JagexHiscoreResponse, WiseOldManActivitySnapshotMetric,
    WiseOldManActivitySummaryDisplayType, WiseOldManActivitySummaryEntry,
    WiseOldManBossKcEntry, WiseOldManPlayerBossKc,
};
use crate::validators::valid_name;
use actix_web::{get, http::header::ContentType, post, web, Error, HttpResponse};
use arc_swap::{ArcSwap, ArcSwapAny};
use chrono::{Duration as ChronoDuration, Utc};
use deadpool_postgres::{Client, Pool};
use lazy_static::lazy_static;
use std::sync::Arc;
use std::time::Duration;
use tokio::{task, time};

const JAGEX_HISCORE_USER_AGENT: &str = "Group Ironmen - Dprk#8740";
const JAGEX_HISCORE_CACHE_TTL_SECONDS: i64 = 5 * 60;
const PRIMARY_JAGEX_HISCORE_ENDPOINTS: [(&str, &str); 4] = [
    (
        "normal",
        "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json",
    ),
    (
        "ironman",
        "https://services.runescape.com/m=hiscore_oldschool_ironman/index_lite.json",
    ),
    (
        "hardcore_ironman",
        "https://services.runescape.com/m=hiscore_oldschool_hardcore_ironman/index_lite.json",
    ),
    (
        "ultimate_ironman",
        "https://services.runescape.com/m=hiscore_oldschool_ultimate/index_lite.json",
    ),
];
const SEASONAL_JAGEX_HISCORE_ENDPOINT: (&str, &str) = (
    "seasonal",
    "https://services.runescape.com/m=hiscore_oldschool_seasonal/index_lite.json",
);
const WISE_OLD_MAN_CLUE_SCROLL_METRICS: [&str; 6] = [
    "clue_scrolls_beginner",
    "clue_scrolls_easy",
    "clue_scrolls_medium",
    "clue_scrolls_hard",
    "clue_scrolls_elite",
    "clue_scrolls_master",
];

struct WiseOldManActivitySummarySpec {
    metric: &'static str,
    label: &'static str,
    display_type: WiseOldManActivitySummaryDisplayType,
}

const WISE_OLD_MAN_ACTIVITY_SUMMARY_SPECS: [WiseOldManActivitySummarySpec; 10] = [
    WiseOldManActivitySummarySpec {
        metric: "clue_scrolls_all",
        label: "Clue completions",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "league_points",
        label: "League points",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "last_man_standing",
        label: "LMS rank",
        display_type: WiseOldManActivitySummaryDisplayType::Rank,
    },
    WiseOldManActivitySummarySpec {
        metric: "soul_wars_zeal",
        label: "Soul Wars zeal",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "guardians_of_the_rift",
        label: "Rifts closed",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "colosseum_glory",
        label: "Colosseum glory",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "collections_logged",
        label: "Collections logged",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "bounty_hunter_rogue",
        label: "Bounty Hunter rogue",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "bounty_hunter_hunter",
        label: "Bounty Hunter",
        display_type: WiseOldManActivitySummaryDisplayType::Score,
    },
    WiseOldManActivitySummarySpec {
        metric: "pvp_arena",
        label: "PvP Arena rank",
        display_type: WiseOldManActivitySummaryDisplayType::Rank,
    },
];

lazy_static! {
    static ref GE_PRICES: ArcSwapAny<Arc<String>> = ArcSwap::from(Arc::new(String::default()));
    static ref HTTP_CLIENT: reqwest::Client = reqwest::Client::new();
}

fn encode_player_name_for_url(player_name: &str) -> String {
    player_name.replace(' ', "%20")
}

fn jagex_hiscore_profile_url(base_url: &str, player_name: &str) -> String {
    format!("{}?player={}", base_url, encode_player_name_for_url(player_name))
}

fn normalize_metric_name(name: &str) -> String {
    let mut metric = String::with_capacity(name.len());
    let mut last_was_separator = true;

    for ch in name.chars() {
        let normalized = if ch == '&' {
            Some("and".to_string())
        } else if ch.is_ascii_alphanumeric() {
            Some(ch.to_ascii_lowercase().to_string())
        } else {
            None
        };

        match normalized {
            Some(value) => {
                if !metric.is_empty() && last_was_separator {
                    metric.push('_');
                }
                metric.push_str(&value);
                last_was_separator = false;
            }
            None => {
                last_was_separator = true;
            }
        }
    }

    match metric.as_str() {
        "lms_rank" => "last_man_standing".to_string(),
        "pvp_arena_rank" => "pvp_arena".to_string(),
        "rifts_closed" => "guardians_of_the_rift".to_string(),
        _ => metric,
    }
}

fn normalize_jagex_activity_map(
    activities: &[JagexHiscoreActivityEntry],
) -> std::collections::HashMap<String, WiseOldManActivitySnapshotMetric> {
    activities
        .iter()
        .map(|activity| {
            let metric = normalize_metric_name(&activity.name);
            (
                metric.clone(),
                WiseOldManActivitySnapshotMetric {
                    metric,
                    score: activity.score,
                    rank: activity.rank,
                },
            )
        })
        .collect()
}

fn is_boss_metric(metric: &str) -> bool {
    !matches!(
        metric,
        "grid_points"
            | "league_points"
            | "deadman_points"
            | "bounty_hunter_hunter"
            | "bounty_hunter_rogue"
            | "bounty_hunter_legacy_hunter"
            | "bounty_hunter_legacy_rogue"
            | "clue_scrolls_all"
            | "clue_scrolls_beginner"
            | "clue_scrolls_easy"
            | "clue_scrolls_medium"
            | "clue_scrolls_hard"
            | "clue_scrolls_elite"
            | "clue_scrolls_master"
            | "last_man_standing"
            | "pvp_arena"
            | "soul_wars_zeal"
            | "guardians_of_the_rift"
            | "colosseum_glory"
            | "collections_logged"
    )
}

fn normalize_boss_entries(activities: &[JagexHiscoreActivityEntry]) -> Vec<WiseOldManBossKcEntry> {
    let mut entries = activities
        .iter()
        .filter_map(|activity| {
            let metric = normalize_metric_name(&activity.name);
            if !is_boss_metric(&metric) || activity.score <= 0 {
                return None;
            }

            Some(WiseOldManBossKcEntry {
                metric,
                name: activity.name.clone(),
                kills: activity.score,
                rank: if activity.rank > 0 {
                    Some(activity.rank)
                } else {
                    None
                },
                ehb: None,
            })
        })
        .collect::<Vec<WiseOldManBossKcEntry>>();

    entries.sort_by(|left, right| {
        right
            .kills
            .cmp(&left.kills)
            .then_with(|| left.name.cmp(&right.name))
    });

    entries
}

fn normalize_activity_summary_entries(
    activities: &std::collections::HashMap<String, WiseOldManActivitySnapshotMetric>,
) -> Vec<WiseOldManActivitySummaryEntry> {
    WISE_OLD_MAN_ACTIVITY_SUMMARY_SPECS
        .iter()
        .map(|spec| {
            let activity = activities.get(spec.metric);
            let score = if spec.metric == "clue_scrolls_all" {
                resolve_clue_completion_score(activities)
            } else {
                normalized_activity_score(activity)
            };
            let rank = activity.and_then(|value| (value.rank > 0).then_some(value.rank));

            WiseOldManActivitySummaryEntry {
                metric: activity
                    .map(|value| value.metric.clone())
                    .unwrap_or_else(|| spec.metric.to_string()),
                label: spec.label.to_string(),
                display_type: spec.display_type,
                score,
                rank,
            }
        })
        .collect()
}

fn normalized_activity_score(activity: Option<&WiseOldManActivitySnapshotMetric>) -> Option<i64> {
    activity.and_then(|value| (value.score >= 0).then_some(value.score))
}

fn resolve_clue_completion_score(
    activities: &std::collections::HashMap<String, WiseOldManActivitySnapshotMetric>,
) -> Option<i64> {
    let mut total_score = 0;
    let mut has_tier_score = false;

    for metric in WISE_OLD_MAN_CLUE_SCROLL_METRICS {
        if let Some(score) = normalized_activity_score(activities.get(metric)) {
            total_score += score;
            has_tier_score = true;
        }
    }

    if has_tier_score {
        Some(total_score)
    } else {
        normalized_activity_score(activities.get("clue_scrolls_all"))
    }
}

fn build_wise_old_man_player_boss_kc(
    player: JagexHiscoreResponse,
    seasonal_player: Option<JagexHiscoreResponse>,
    player_name: &str,
    profile_url: &str,
) -> WiseOldManPlayerBossKc {
    let mut activities = normalize_jagex_activity_map(&player.activities);

    if let Some(seasonal_player) = seasonal_player {
        if let Some(seasonal_league_points) = seasonal_player
            .activities
            .iter()
            .find(|activity| normalize_metric_name(&activity.name) == "league_points")
        {
            activities.insert(
                "league_points".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "league_points".to_string(),
                    score: seasonal_league_points.score,
                    rank: seasonal_league_points.rank,
                },
            );
        }
    }

    let bosses = normalize_boss_entries(&player.activities);
    let summary = normalize_activity_summary_entries(&activities);

    WiseOldManPlayerBossKc {
        schema_version: WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION,
        player_name: if player.name.trim().is_empty() {
            player_name.to_string()
        } else {
            player.name
        },
        updated_at: Some(Utc::now()),
        profile_url: profile_url.to_string(),
        summary,
        bosses,
    }
}

async fn fetch_jagex_hiscore_response(
    player_name: &str,
) -> Result<Option<(JagexHiscoreResponse, &'static str)>, ApiError> {
    for (_, endpoint_url) in PRIMARY_JAGEX_HISCORE_ENDPOINTS {
        let response = HTTP_CLIENT
            .get(endpoint_url)
            .query(&[("player", player_name)])
            .header("Accept", "application/json")
            .header("User-Agent", JAGEX_HISCORE_USER_AGENT)
            .send()
            .await
            .map_err(ApiError::ReqwestError)?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            continue;
        }

        let response = response.error_for_status().map_err(ApiError::ReqwestError)?;
        let payload = response
            .json::<JagexHiscoreResponse>()
            .await
            .map_err(ApiError::ReqwestError)?;

        return Ok(Some((payload, endpoint_url)));
    }

    Ok(None)
}

async fn fetch_seasonal_jagex_hiscore_response(
    player_name: &str,
) -> Result<Option<JagexHiscoreResponse>, ApiError> {
    let response = HTTP_CLIENT
        .get(SEASONAL_JAGEX_HISCORE_ENDPOINT.1)
        .query(&[("player", player_name)])
        .header("Accept", "application/json")
        .header("User-Agent", JAGEX_HISCORE_USER_AGENT)
        .send()
        .await
        .map_err(ApiError::ReqwestError)?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }

    let response = response.error_for_status().map_err(ApiError::ReqwestError)?;

    response
        .json::<JagexHiscoreResponse>()
        .await
        .map_err(ApiError::ReqwestError)
        .map(Some)
}

pub async fn fetch_latest_prices() -> Result<WikiGEPrices, ApiError> {
    let res = HTTP_CLIENT
        .get("https://prices.runescape.wiki/api/v1/osrs/latest")
        .header("User-Agent", "Group Ironmen - Dprk#8740")
        .send()
        .await
        .map_err(ApiError::ReqwestError)?;
    let wiki_ge_prices = res
        .json::<WikiGEPrices>()
        .await
        .map_err(ApiError::ReqwestError)?;

    Ok(wiki_ge_prices)
}

pub async fn update_ge_prices() -> Result<(), ApiError> {
    let wiki_ge_prices = fetch_latest_prices().await?;
    let mut ge_prices: GEPrices = std::collections::HashMap::new();
    for (item_id, wiki_ge_price) in wiki_ge_prices.data {
        let mut avg_ge_price: i64 = 0;
        match wiki_ge_price.high {
            Some(high) => avg_ge_price = high,
            None => (),
        }
        match wiki_ge_price.low {
            Some(low) => {
                if avg_ge_price > 0 {
                    avg_ge_price = (avg_ge_price + low) / 2
                } else {
                    avg_ge_price = low
                }
            }
            None => (),
        }

        ge_prices.insert(item_id, avg_ge_price);
    }

    GE_PRICES.store(Arc::new(serde_json::to_string(&ge_prices)?));

    Ok(())
}

pub fn start_ge_updater() {
    task::spawn(async {
        let mut interval = time::interval(Duration::from_secs(14400));

        loop {
            interval.tick().await;
            log::info!("Fetching latest ge prices");

            match update_ge_prices().await {
                Ok(_) => (),
                Err(err) => {
                    log::error!("Failed to fetch latest ge prices: {}", err);
                }
            }
        }
    });
}

pub fn start_skills_aggregator(db_pool: Pool) {
    task::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(1800));

        loop {
            interval.tick().await;
            log::info!("Running skill aggregator");

            match db_pool.get().await {
                Ok(mut client) => {
                    match db::aggregate_skills(&mut client).await {
                        Ok(_) => (),
                        Err(err) => {
                            log::error!("Failed to aggregate skills: {}", err);
                        }
                    }

                    match db::apply_skills_retention(&mut client).await {
                        Ok(_) => (),
                        Err(err) => {
                            log::error!("Failed to apply skills retention: {}", err);
                        }
                    }
                }
                Err(err) => {
                    log::error!("Failed to get db client: {}", err);
                }
            }
        }
    });
}

#[get("/ge-prices")]
pub async fn get_ge_prices() -> Result<HttpResponse, Error> {
    let ge_prices_opt = GE_PRICES.load();
    let res: String = (&**ge_prices_opt).clone();

    Ok(HttpResponse::Ok()
        .append_header(("Cache-Control", "public, max-age=86400"))
        .content_type("application/json")
        .body(res))
}

pub async fn verify_captcha(
    response: &String,
    secret: &String,
) -> Result<CaptchaVerifyResponse, ApiError> {
    let body = [("response", response), ("secret", secret)];

    let res = HTTP_CLIENT
        .post("https://hcaptcha.com/siteverify")
        .form(&body)
        .send()
        .await
        .map_err(ApiError::ReqwestError)?;
    let captcha_verify_response = res
        .json::<CaptchaVerifyResponse>()
        .await
        .map_err(ApiError::ReqwestError)?;

    Ok(captcha_verify_response)
}

#[post("/create-group")]
pub async fn create_group(
    create_group: web::Json<CreateGroup>,
    db_pool: web::Data<Pool>,
    config: web::Data<Config>,
) -> Result<HttpResponse, Error> {
    let mut create_group_inner = create_group.into_inner();

    if config.hcaptcha.enabled {
        let captcha_verify_response = verify_captcha(
            &create_group_inner.captcha_response,
            &config.hcaptcha.secret,
        )
        .await?;
        if !captcha_verify_response.success {
            return Ok(HttpResponse::BadRequest().body("Captcha response verification failed"));
        }
    }

    if create_group_inner.member_names.len() > 5 {
        return Ok(HttpResponse::BadRequest().body("Too many member names provided"));
    }

    create_group_inner.name = create_group_inner.name.trim().to_string();
    if !valid_name(&create_group_inner.name) {
        return Ok(HttpResponse::BadRequest().body("Provided group name is not valid"));
    }

    create_group_inner
        .member_names
        .retain(|member_name| member_name.trim().len() > 0);
    for member_name in &create_group_inner.member_names {
        if !valid_name(&member_name) {
            return Ok(HttpResponse::BadRequest()
                .body(format!("Member name {} is not valid", member_name)));
        }
    }

    let mut client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    db::create_group(&mut client, &create_group_inner).await?;
    Ok(HttpResponse::Created().json(&create_group_inner))
}

#[get("captcha-enabled")]
pub async fn captcha_enabled(config: web::Data<Config>) -> Result<HttpResponse, Error> {
    Ok(HttpResponse::Ok().json(&config.hcaptcha))
}

#[get("collection-log-info")]
pub async fn collection_log_info() -> HttpResponse {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body(&**COLLECTION_LOG_DATA)
}

#[get("/wise-old-man/players/{player_name}/boss-kc")]
pub async fn get_wise_old_man_player_boss_kc(
    player_name: web::Path<String>,
    db_pool: web::Data<Pool>,
) -> Result<HttpResponse, Error> {
    let player_name = player_name.into_inner().trim().to_string();
    if !valid_name(&player_name) {
        return Ok(HttpResponse::BadRequest().body("Provided player name is not valid"));
    }

    let cache_key = player_name.to_ascii_lowercase();
    {
        let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
        if let Some(cached_payload) = db::get_cached_wise_old_man_player_boss_kc(&client, &cache_key).await? {
            if cached_payload.schema_version >= WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION {
                return Ok(HttpResponse::Ok()
                    .append_header(("Cache-Control", "no-store"))
                    .json(cached_payload));
            }
        }
    }

    let Some((player, endpoint_url)) = fetch_jagex_hiscore_response(&player_name).await? else {
        return Ok(HttpResponse::NotFound().body(format!(
            "{} was not found on the OSRS hiscores.",
            player_name
        )));
    };
    let seasonal_player = fetch_seasonal_jagex_hiscore_response(&player_name).await?;
    let player_boss_kc = build_wise_old_man_player_boss_kc(
        player,
        seasonal_player,
        &player_name,
        &jagex_hiscore_profile_url(endpoint_url, &player_name),
    );
    let expires_at = Utc::now() + ChronoDuration::seconds(JAGEX_HISCORE_CACHE_TTL_SECONDS);

    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    db::upsert_wise_old_man_player_boss_kc(&client, &cache_key, &player_boss_kc, &expires_at)
        .await?;

    Ok(HttpResponse::Ok()
        .append_header(("Cache-Control", "no-store"))
        .json(player_boss_kc))
}

#[cfg(test)]
mod tests {
    use super::{
        build_wise_old_man_player_boss_kc, normalize_activity_summary_entries,
        WiseOldManActivitySnapshotMetric,
    };
    use crate::models::{JagexHiscoreActivityEntry, JagexHiscoreResponse};
    use std::collections::HashMap;

    #[test]
    fn clue_completion_summary_uses_tier_totals_when_available() {
        let activities = HashMap::from([
            (
                "clue_scrolls_all".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_all".to_string(),
                    score: 53,
                    rank: 10,
                },
            ),
            (
                "clue_scrolls_beginner".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_beginner".to_string(),
                    score: 40,
                    rank: 20,
                },
            ),
            (
                "clue_scrolls_easy".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_easy".to_string(),
                    score: 50,
                    rank: 30,
                },
            ),
            (
                "clue_scrolls_medium".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_medium".to_string(),
                    score: 60,
                    rank: 40,
                },
            ),
            (
                "clue_scrolls_hard".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_hard".to_string(),
                    score: 20,
                    rank: 50,
                },
            ),
            (
                "clue_scrolls_elite".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_elite".to_string(),
                    score: 10,
                    rank: 60,
                },
            ),
            (
                "clue_scrolls_master".to_string(),
                WiseOldManActivitySnapshotMetric {
                    metric: "clue_scrolls_master".to_string(),
                    score: 13,
                    rank: 70,
                },
            ),
        ]);

        let summary = normalize_activity_summary_entries(&activities);
        let clue_summary = summary
            .iter()
            .find(|entry| entry.metric == "clue_scrolls_all")
            .expect("clue summary should exist");

        assert_eq!(clue_summary.score, Some(193));
        assert_eq!(clue_summary.rank, Some(10));
    }

    #[test]
    fn clue_completion_summary_falls_back_to_all_metric() {
        let activities = HashMap::from([(
            "clue_scrolls_all".to_string(),
            WiseOldManActivitySnapshotMetric {
                metric: "clue_scrolls_all".to_string(),
                score: 53,
                rank: 10,
            },
        )]);

        let summary = normalize_activity_summary_entries(&activities);
        let clue_summary = summary
            .iter()
            .find(|entry| entry.metric == "clue_scrolls_all")
            .expect("clue summary should exist");

        assert_eq!(clue_summary.score, Some(53));
    }

    #[test]
    fn boss_kc_payload_uses_seasonal_league_points_when_available() {
        let base_player = JagexHiscoreResponse {
            name: "og joshua".to_string(),
            activities: vec![JagexHiscoreActivityEntry {
                name: "League Points".to_string(),
                rank: -1,
                score: 0,
            }],
        };
        let seasonal_player = JagexHiscoreResponse {
            name: "og joshua".to_string(),
            activities: vec![JagexHiscoreActivityEntry {
                name: "League Points".to_string(),
                rank: 123,
                score: 456,
            }],
        };

        let payload = build_wise_old_man_player_boss_kc(
            base_player,
            Some(seasonal_player),
            "og joshua",
            "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=og%20joshua",
        );
        let league_summary = payload
            .summary
            .iter()
            .find(|entry| entry.metric == "league_points")
            .expect("league points summary should exist");

        assert_eq!(league_summary.score, Some(456));
        assert_eq!(league_summary.rank, Some(123));
    }
}
