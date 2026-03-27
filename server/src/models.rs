use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const SHARED_MEMBER: &str = "@SHARED";
pub const WISE_OLD_MAN_PLAYER_BOSS_KC_SCHEMA_VERSION: i32 = 3;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Coordinates {
    x: i32,
    y: i32,
    plane: i32,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Interacting {
    name: String,
    scale: i32,
    ratio: i32,
    location: Coordinates,
    #[serde(default = "default_last_updated")]
    last_updated: DateTime<Utc>,
}
fn default_last_updated() -> DateTime<Utc> {
    Utc::now()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenameGroupMember {
    pub original_name: String,
    pub new_name: String,
}

#[derive(Deserialize, Serialize)]
pub struct GroupMember {
    #[serde(skip)]
    pub group_id: Option<i64>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coordinates: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quests: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inventory: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub equipment: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bank: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shared_bank: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rune_pouch: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interacting: Option<Interacting>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed_vault: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deposited: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diary_vars: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_log_v2: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<DateTime<Utc>>,
}

impl GroupMember {
    pub fn present_fields(&self) -> Vec<&'static str> {
        let mut fields = Vec::new();

        if self.stats.is_some() {
            fields.push("stats");
        }
        if self.coordinates.is_some() {
            fields.push("coordinates");
        }
        if self.skills.is_some() {
            fields.push("skills");
        }
        if self.quests.is_some() {
            fields.push("quests");
        }
        if self.inventory.is_some() {
            fields.push("inventory");
        }
        if self.equipment.is_some() {
            fields.push("equipment");
        }
        if self.bank.is_some() {
            fields.push("bank");
        }
        if self.shared_bank.is_some() {
            fields.push("shared_bank");
        }
        if self.rune_pouch.is_some() {
            fields.push("rune_pouch");
        }
        if self.interacting.is_some() {
            fields.push("interacting");
        }
        if self.seed_vault.is_some() {
            fields.push("seed_vault");
        }
        if self.deposited.is_some() {
            fields.push("deposited");
        }
        if self.diary_vars.is_some() {
            fields.push("diary_vars");
        }
        if self.collection_log_v2.is_some() {
            fields.push("collection_log_v2");
        }

        fields
    }
}

#[derive(Serialize)]
pub struct AggregateSkillData {
    pub time: DateTime<Utc>,
    pub data: Vec<i32>,
}
#[derive(Serialize)]
pub struct MemberSkillData {
    pub name: String,
    pub skill_data: Vec<AggregateSkillData>,
}
pub type GroupSkillData = Vec<MemberSkillData>;
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CreateGroup {
    pub name: String,
    pub member_names: Vec<String>,
    #[serde(default, skip_serializing)]
    pub captcha_response: String,
    #[serde(default = "default_token")]
    #[serde(skip_deserializing)]
    pub token: String,
}
fn default_token() -> String {
    uuid::Uuid::new_v4().hyphenated().to_string()
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AmIInGroupRequest {
    pub member_name: String,
}
#[derive(Deserialize)]
pub struct WikiGEPrice {
    pub high: Option<i64>,
    pub low: Option<i64>,
}
#[derive(Deserialize)]
pub struct WikiGEPrices {
    pub data: std::collections::HashMap<i32, WikiGEPrice>,
}
pub type GEPrices = std::collections::HashMap<i32, i64>;
#[derive(Deserialize)]
pub struct CaptchaVerifyResponse {
    pub success: bool,
    // NOTE: unused
    // #[serde(rename = "error-codes", default)]
    // pub error_codes: std::vec::Vec<String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Clone)]
pub struct JagexHiscoreSkillEntry {
    pub name: String,
    pub rank: i64,
    pub level: i64,
    pub xp: i64,
}

#[derive(Deserialize, Clone)]
pub struct JagexHiscoreActivityEntry {
    pub name: String,
    pub rank: i64,
    pub score: i64,
}

#[derive(Deserialize, Clone)]
pub struct JagexHiscoreResponse {
    pub name: String,
    #[serde(default)]
    pub activities: Vec<JagexHiscoreActivityEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WiseOldManBossKcEntry {
    pub metric: String,
    pub name: String,
    pub kills: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ehb: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum WiseOldManActivitySummaryDisplayType {
    Score,
    Rank,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WiseOldManActivitySummaryEntry {
    pub metric: String,
    pub label: String,
    #[serde(rename = "displayType")]
    pub display_type: WiseOldManActivitySummaryDisplayType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WiseOldManPlayerBossKc {
    #[serde(rename = "schemaVersion", default)]
    pub schema_version: i32,
    #[serde(rename = "playerName")]
    pub player_name: String,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(rename = "profileUrl")]
    pub profile_url: String,
    #[serde(default)]
    pub summary: Vec<WiseOldManActivitySummaryEntry>,
    pub bosses: Vec<WiseOldManBossKcEntry>,
}

#[derive(Deserialize)]
pub struct WiseOldManActivitySnapshotMetric {
    pub metric: String,
    pub score: i64,
    pub rank: i64,
}
