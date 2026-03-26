#![allow(dead_code, unused_imports)]

#[path = "../src/auth_middleware.rs"]
mod auth_middleware;
#[path = "../src/collection_log.rs"]
mod collection_log;
#[path = "../src/config.rs"]
mod config;
#[path = "../src/crypto.rs"]
mod crypto;
#[path = "../src/db.rs"]
mod db;
#[path = "../src/error.rs"]
mod error;
#[path = "../src/models.rs"]
mod models;
#[path = "../src/unauthed.rs"]
mod unauthed;
#[path = "../src/validators.rs"]
mod validators;

use actix_web::{http::{header, StatusCode}, test, web, App, HttpResponse};
use auth_middleware::AuthenticateMiddlewareFactory;

fn test_config() -> config::Config {
    config::Config {
        pg: deadpool_postgres::Config::new(),
        logger: config::LoggerConfig {
            level: config::LogLevel::Info,
        },
        hcaptcha: config::CaptchaConfig {
            enabled: false,
            sitekey: String::new(),
            secret: String::new(),
        },
    }
}

#[actix_web::test]
async fn captcha_enabled_endpoint_returns_configured_state() {
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(test_config()))
            .service(web::scope("/api").service(unauthed::captcha_enabled)),
    )
    .await;

    let response = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/captcha-enabled").to_request(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
    let body = test::read_body(response).await;
    let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(payload["enabled"], false);
    assert_eq!(payload["sitekey"], "");
}

#[actix_web::test]
async fn collection_log_info_endpoint_returns_json_payload() {
    let app = test::init_service(
        App::new().service(web::scope("/api").service(unauthed::collection_log_info)),
    )
    .await;

    let response = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/collection-log-info").to_request(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::CONTENT_TYPE).unwrap(),
        "application/json"
    );

    let body = test::read_body(response).await;
    assert!(!body.is_empty());
}

#[actix_web::test]
async fn ge_prices_endpoint_returns_cacheable_json_response() {
    let app = test::init_service(
        App::new().service(web::scope("/api").service(unauthed::get_ge_prices)),
    )
    .await;

    let response = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/ge-prices").to_request(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::CONTENT_TYPE).unwrap(),
        "application/json"
    );
    assert_eq!(
        response.headers().get("Cache-Control").unwrap(),
        "public, max-age=86400"
    );
}

#[actix_web::test]
async fn auth_middleware_allows_shared_group_without_auth_header() {
    let app = test::init_service(
        App::new().service(
            web::scope("/api/group/{group_name}")
                .wrap(AuthenticateMiddlewareFactory::new())
                .route(
                    "/ping",
                    web::get().to(|| async { HttpResponse::Ok().finish() }),
                ),
        ),
    )
    .await;

    let response = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/group/_/ping").to_request(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[actix_web::test]
async fn auth_middleware_rejects_missing_auth_header() {
    let app = test::init_service(
        App::new().service(
            web::scope("/api/group/{group_name}")
                .wrap(AuthenticateMiddlewareFactory::new())
                .route(
                    "/ping",
                    web::get().to(|| async { HttpResponse::Ok().finish() }),
                ),
        ),
    )
    .await;

    let response = test::call_service(
        &app,
        test::TestRequest::get().uri("/api/group/test/ping").to_request(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
