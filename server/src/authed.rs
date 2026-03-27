use crate::auth_middleware::Authenticated;
use crate::db;
use crate::error::ApiError;
use crate::models::{
    AmIInGroupRequest, GroupMember, GroupSkillData, RenameGroupMember, SHARED_MEMBER,
};
use crate::notifier::GroupEventNotifier;
use crate::validators::{valid_name, validate_member_prop_length};
use actix_web::{delete, get, http::header, post, put, web, Error, HttpResponse};
use actix_web::web::Bytes;
use chrono::{DateTime, Utc};
use deadpool_postgres::{Client, Pool};
use futures_util::stream::{self, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tokio_stream::wrappers::errors::BroadcastStreamRecvError;
use tokio_stream::wrappers::{BroadcastStream, IntervalStream};

#[post("/add-group-member")]
pub async fn add_group_member(
    auth: Authenticated,
    group_member: web::Json<GroupMember>,
    db_pool: web::Data<Pool>,
    notifier: web::Data<GroupEventNotifier>,
) -> Result<HttpResponse, Error> {
    if group_member.name.eq(SHARED_MEMBER) {
        return Ok(
            HttpResponse::BadRequest().body(format!("Member name {} not allowed", SHARED_MEMBER))
        );
    }

    if !valid_name(&group_member.name) {
        return Ok(HttpResponse::BadRequest()
            .body(format!("Member name {} is not valid", group_member.name)));
    }

    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    db::add_group_member(&client, auth.group_id, &group_member.name).await?;
    notifier.notify_group(auth.group_id);
    Ok(HttpResponse::Created().finish())
}

#[delete("/delete-group-member")]
pub async fn delete_group_member(
    auth: Authenticated,
    group_member: web::Json<GroupMember>,
    db_pool: web::Data<Pool>,
    notifier: web::Data<GroupEventNotifier>,
) -> Result<HttpResponse, Error> {
    if group_member.name.eq(SHARED_MEMBER) {
        return Ok(
            HttpResponse::BadRequest().body(format!("Member name {} not allowed", SHARED_MEMBER))
        );
    }

    let mut client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    db::delete_group_member(&mut client, auth.group_id, &group_member.name).await?;
    notifier.notify_group(auth.group_id);
    Ok(HttpResponse::Ok().finish())
}

#[put("/rename-group-member")]
pub async fn rename_group_member(
    auth: Authenticated,
    rename_member: web::Json<RenameGroupMember>,
    db_pool: web::Data<Pool>,
    notifier: web::Data<GroupEventNotifier>,
) -> Result<HttpResponse, Error> {
    if rename_member.original_name.eq(SHARED_MEMBER) || rename_member.new_name.eq(SHARED_MEMBER) {
        return Ok(
            HttpResponse::BadRequest().body(format!("Member name {} not allowed", SHARED_MEMBER))
        );
    }

    if !valid_name(&rename_member.new_name) {
        return Ok(HttpResponse::BadRequest().body(format!(
            "Member name {} is not valid",
            rename_member.new_name
        )));
    }

    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    db::rename_group_member(
        &client,
        auth.group_id,
        &rename_member.original_name,
        &rename_member.new_name,
    )
    .await?;
    notifier.notify_group(auth.group_id);
    Ok(HttpResponse::Ok().finish())
}

#[post("/update-group-member")]
pub async fn update_group_member(
    auth: Authenticated,
    group_member: web::Json<GroupMember>,
    db_pool: web::Data<Pool>,
    sender: web::Data<mpsc::Sender<GroupMember>>
) -> Result<HttpResponse, Error> {
    {
        let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
        let in_group: bool = db::is_member_in_group(&client, auth.group_id, &group_member.name).await?;
        if !in_group {
            return Ok(HttpResponse::Unauthorized().body("Player is not a member of this group"));
        }
    }

    let mut group_member_inner: GroupMember = group_member.into_inner();
    group_member_inner.group_id = Some(auth.group_id);

    validate_member_prop_length("stats", &group_member_inner.stats, 7, 7)?;
    validate_member_prop_length("coordinates", &group_member_inner.coordinates, 3, 4)?;
    validate_member_prop_length("skills", &group_member_inner.skills, 23, 24)?;
    validate_member_prop_length("quests", &group_member_inner.quests, 0, 220)?;
    validate_member_prop_length("inventory", &group_member_inner.inventory, 56, 56)?;
    validate_member_prop_length("equipment", &group_member_inner.equipment, 28, 28)?;
    validate_member_prop_length("bank", &group_member_inner.bank, 0, 3000)?;
    validate_member_prop_length("shared_bank", &group_member_inner.shared_bank, 0, 1000)?;
    validate_member_prop_length("rune_pouch", &group_member_inner.rune_pouch, 6, 8)?;
    validate_member_prop_length("seed_vault", &group_member_inner.seed_vault, 0, 500)?;
    validate_member_prop_length("deposited", &group_member_inner.deposited, 0, 200)?;
    validate_member_prop_length("diary_vars", &group_member_inner.diary_vars, 0, 62)?;
    validate_member_prop_length("collection_log_v2", &group_member_inner.collection_log_v2, 0, 4000)?;

    log::info!(
        "Queueing group update group_id={} member={} fields={:?}",
        auth.group_id,
        group_member_inner.name,
        group_member_inner.present_fields()
    );

    match sender.send(group_member_inner).await {
        Ok(_) => Ok(HttpResponse::Ok().finish()),
        Err(_) => Ok(HttpResponse::InternalServerError().body("Failed to submit player update")),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GetGroupDataQuery {
    pub from_time: DateTime<Utc>,
}
#[get("/get-group-data")]
pub async fn get_group_data(
    auth: Authenticated,
    db_pool: web::Data<Pool>,
    query: web::Query<GetGroupDataQuery>,
) -> Result<web::Json<Vec<GroupMember>>, Error> {
    let from_time = query.from_time;
    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    let group_members = db::get_group_data(&client, auth.group_id, &from_time).await?;
    log::info!(
        "Returning group data group_id={} from_time={} members={}",
        auth.group_id,
        from_time,
        group_members.len()
    );
    Ok(web::Json(group_members))
}

#[get("/group-events")]
pub async fn get_group_events(
    auth: Authenticated,
    notifier: web::Data<GroupEventNotifier>,
) -> Result<HttpResponse, Error> {
    let receiver = notifier.subscribe(auth.group_id);
    let initial = stream::once(async { Ok::<Bytes, Error>(Bytes::from_static(b": connected\n\n")) });
    let keep_alive = IntervalStream::new(time::interval(Duration::from_secs(30))).map(|_| {
        Ok::<Bytes, Error>(Bytes::from_static(b": keep-alive\n\n"))
    });
    let updates = BroadcastStream::new(receiver).filter_map(|message| async move {
        match message {
            Ok(_) | Err(BroadcastStreamRecvError::Lagged(_)) => {
                Some(Ok::<Bytes, Error>(Bytes::from_static(b"data: update\n\n")))
            }
        }
    });

    let body = initial.chain(stream::select(keep_alive, updates));

    Ok(HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/event-stream; charset=utf-8"))
        .insert_header((header::CACHE_CONTROL, "no-cache, no-transform"))
        .insert_header((header::CONNECTION, "keep-alive"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(body))
}

#[derive(Deserialize)]
pub enum SkillDataPeriod {
    Day,
    Week,
    Month,
    Year,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GetSkillDataQuery {
    pub period: SkillDataPeriod,
}
#[get("/get-skill-data")]
pub async fn get_skill_data(
    auth: Authenticated,
    db_pool: web::Data<Pool>,
    query: web::Query<GetSkillDataQuery>,
) -> Result<web::Json<GroupSkillData>, Error> {
    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    let aggregate_period = match query.period {
        SkillDataPeriod::Day => db::AggregatePeriod::Day,
        SkillDataPeriod::Week => db::AggregatePeriod::Month,
        SkillDataPeriod::Month => db::AggregatePeriod::Month,
        SkillDataPeriod::Year => db::AggregatePeriod::Year,
    };
    let group_skill_data =
        db::get_skills_for_period(&client, auth.group_id, aggregate_period).await?;
    Ok(web::Json(group_skill_data))
}

#[get("/am-i-logged-in")]
pub async fn am_i_logged_in(_auth: Authenticated) -> Result<HttpResponse, Error> {
    Ok(HttpResponse::Ok().finish())
}

#[get("/am-i-in-group")]
pub async fn am_i_in_group(
    auth: Authenticated,
    db_pool: web::Data<Pool>,
    q: web::Query<AmIInGroupRequest>,
) -> Result<HttpResponse, Error> {
    let client: Client = db_pool.get().await.map_err(ApiError::PoolError)?;
    let in_group: bool = db::is_member_in_group(&client, auth.group_id, &q.member_name).await?;

    if !in_group {
        return Ok(HttpResponse::Unauthorized().body("Player is not a member of this group"));
    }
    Ok(HttpResponse::Ok().finish())
}

#[get("/collection-log")]
pub async fn get_collection_log(
) -> Result<web::Json<HashMap<String, Vec<i32>>>, Error> {
    Ok(web::Json(HashMap::new()))
}
