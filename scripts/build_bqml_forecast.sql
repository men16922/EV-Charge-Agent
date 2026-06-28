-- build_bqml_forecast.sql
-- Provisions the BigQuery ML demand-forecast model that the deployed MCP Toolbox
-- tool `predict_charging_demand` queries via ML.FORECAST.
--
-- Builds: dataset ev_data_schema -> synthetic hourly demand table -> ARIMA_PLUS model.
-- Run as a project owner:  bq query --use_legacy_sql=false --project_id <PROJECT> < this file
-- (synthetic data is tiny: 3 zones * ~60 days hourly, so training cost is negligible)

CREATE SCHEMA IF NOT EXISTS `project-ec7809f7-0fb5-45d4-b6d.ev_data_schema`
OPTIONS(location = 'US');

-- Synthetic historical demand: matches the mock shape in mcp_server_local.py
-- (GANGNAM ~85 base, others lower; intraday peaks at 12-15h & 18-21h; weekend uplift).
CREATE OR REPLACE TABLE `project-ec7809f7-0fb5-45d4-b6d.ev_data_schema.historical_charging_demand` AS
SELECT
  zones.zone_id,
  ts AS demand_timestamp,
  GREATEST(0,
    zones.base_demand
      * CASE
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 15
            OR EXTRACT(HOUR FROM ts) BETWEEN 18 AND 21 THEN 1.3
          ELSE 0.8
        END
      * CASE WHEN EXTRACT(DAYOFWEEK FROM ts) IN (1, 7) THEN 1.15 ELSE 1.0 END
      + (RAND() - 0.5) * 10.0
  ) AS demand_kwh
FROM
  UNNEST([
    STRUCT('ZONE_GANGNAM' AS zone_id, 85.0 AS base_demand),
    STRUCT('ZONE_JONGNO'  AS zone_id, 45.0 AS base_demand),
    STRUCT('ZONE_SONGPA'  AS zone_id, 55.0 AS base_demand)
  ]) AS zones,
  UNNEST(GENERATE_TIMESTAMP_ARRAY(
    TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY),
    CURRENT_TIMESTAMP(),
    INTERVAL 1 HOUR
  )) AS ts;

-- ARIMA_PLUS keyed by zone_id so ML.FORECAST emits a zone_id column the tool can filter on.
CREATE OR REPLACE MODEL `project-ec7809f7-0fb5-45d4-b6d.ev_data_schema.ev_demand_forecast_model`
OPTIONS(
  model_type = 'ARIMA_PLUS',
  time_series_timestamp_col = 'demand_timestamp',
  time_series_data_col = 'demand_kwh',
  time_series_id_col = 'zone_id',
  horizon = 168,
  auto_arima = TRUE,
  data_frequency = 'HOURLY'
) AS
SELECT zone_id, demand_timestamp, demand_kwh
FROM `project-ec7809f7-0fb5-45d4-b6d.ev_data_schema.historical_charging_demand`;
