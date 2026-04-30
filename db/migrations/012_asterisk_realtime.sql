-- =====================================================================
--  012_asterisk_realtime.sql
--  Tablas que Asterisk lee vía res_pjsip_realtime + res_config_odbc.
--  El backend escribe troncales y endpoints de agentes aquí, y Asterisk
--  los toma sin reload.
--
--  Esquema oficial de Asterisk 20 (alembic):
--    https://github.com/asterisk/asterisk/tree/master/contrib/realtime
--  Versión simplificada, lo necesario para PJSIP básico.
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ps_aors (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  contact VARCHAR(255) NULL,
  default_expiration INT NULL,
  mailboxes VARCHAR(80) NULL,
  max_contacts INT NULL,
  minimum_expiration INT NULL,
  remove_existing ENUM('yes','no') NULL,
  qualify_frequency INT NULL,
  authenticate_qualify ENUM('yes','no') NULL,
  maximum_expiration INT NULL,
  outbound_proxy VARCHAR(40) NULL,
  support_path ENUM('yes','no') NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ps_auths (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  auth_type ENUM('md5','userpass','google_oauth','userpass_md5','userpass_md5_realm') NULL,
  nonce_lifetime INT NULL,
  md5_cred VARCHAR(40) NULL,
  password VARCHAR(80) NULL,
  realm VARCHAR(40) NULL,
  username VARCHAR(40) NULL,
  refresh_token VARCHAR(255) NULL,
  oauth_clientid VARCHAR(255) NULL,
  oauth_secret VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ps_endpoints (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  transport VARCHAR(40) NULL,
  aors VARCHAR(200) NULL,
  auth VARCHAR(40) NULL,
  context VARCHAR(40) NULL,
  disallow VARCHAR(200) NULL,
  allow VARCHAR(200) NULL,
  direct_media ENUM('yes','no') NULL,
  connected_line_method ENUM('invite','reinvite','update') NULL,
  direct_media_method ENUM('invite','reinvite','update') NULL,
  direct_media_glare_mitigation ENUM('none','outgoing','incoming') NULL,
  disable_direct_media_on_nat ENUM('yes','no') NULL,
  dtmf_mode ENUM('rfc4733','inband','info','auto','auto_info') NULL,
  external_media_address VARCHAR(40) NULL,
  force_rport ENUM('yes','no') NULL,
  ice_support ENUM('yes','no') NULL,
  identify_by VARCHAR(80) NULL,
  mailboxes VARCHAR(40) NULL,
  moh_suggest VARCHAR(40) NULL,
  outbound_auth VARCHAR(40) NULL,
  outbound_proxy VARCHAR(40) NULL,
  rewrite_contact ENUM('yes','no') NULL,
  rtp_ipv6 ENUM('yes','no') NULL,
  rtp_symmetric ENUM('yes','no') NULL,
  send_diversion ENUM('yes','no') NULL,
  send_pai ENUM('yes','no') NULL,
  send_rpid ENUM('yes','no') NULL,
  timers_min_se INT NULL,
  timers ENUM('forced','no','required','yes') NULL,
  timers_sess_expires INT NULL,
  callerid VARCHAR(40) NULL,
  callerid_privacy ENUM('allowed_not_screened','allowed_passed_screened','allowed_failed_screened','allowed','prohib_not_screened','prohib_passed_screened','prohib_failed_screened','prohib','unavailable') NULL,
  callerid_tag VARCHAR(40) NULL,
  trust_id_inbound ENUM('yes','no') NULL,
  trust_id_outbound ENUM('yes','no') NULL,
  use_ptime ENUM('yes','no') NULL,
  use_avpf ENUM('yes','no') NULL,
  media_encryption ENUM('no','sdes','dtls') NULL,
  inband_progress ENUM('yes','no') NULL,
  call_group VARCHAR(40) NULL,
  pickup_group VARCHAR(40) NULL,
  named_call_group VARCHAR(40) NULL,
  named_pickup_group VARCHAR(40) NULL,
  device_state_busy_at INT NULL,
  fax_detect ENUM('yes','no') NULL,
  t38_udptl ENUM('yes','no') NULL,
  t38_udptl_ec ENUM('none','fec','redundancy') NULL,
  t38_udptl_maxdatagram INT NULL,
  t38_udptl_nat ENUM('yes','no') NULL,
  t38_udptl_ipv6 ENUM('yes','no') NULL,
  tone_zone VARCHAR(40) NULL,
  language VARCHAR(40) NULL,
  one_touch_recording ENUM('yes','no') NULL,
  record_on_feature VARCHAR(40) NULL,
  record_off_feature VARCHAR(40) NULL,
  rtp_engine VARCHAR(40) NULL,
  allow_transfer ENUM('yes','no') NULL,
  allow_subscribe ENUM('yes','no') NULL,
  sdp_owner VARCHAR(40) NULL,
  sdp_session VARCHAR(40) NULL,
  tos_audio VARCHAR(10) NULL,
  tos_video VARCHAR(10) NULL,
  sub_min_expiry INT NULL,
  from_user VARCHAR(40) NULL,
  from_domain VARCHAR(40) NULL,
  mwi_from_user VARCHAR(40) NULL,
  dtls_verify VARCHAR(40) NULL,
  dtls_rekey VARCHAR(40) NULL,
  dtls_cert_file VARCHAR(200) NULL,
  dtls_private_key VARCHAR(200) NULL,
  dtls_cipher VARCHAR(200) NULL,
  dtls_ca_file VARCHAR(200) NULL,
  dtls_ca_path VARCHAR(200) NULL,
  dtls_setup ENUM('active','passive','actpass') NULL,
  srtp_tag_32 ENUM('yes','no') NULL,
  asymmetric_rtp_codec ENUM('yes','no') NULL,
  set_var TEXT NULL,
  message_context VARCHAR(40) NULL,
  webrtc ENUM('yes','no') NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ps_registrations (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  outbound_auth VARCHAR(40) NULL,
  outbound_proxy VARCHAR(40) NULL,
  server_uri VARCHAR(255) NULL,
  client_uri VARCHAR(255) NULL,
  contact_user VARCHAR(40) NULL,
  expiration INT NULL,
  retry_interval INT NULL,
  forbidden_retry_interval INT NULL,
  fatal_retry_interval INT NULL,
  transport VARCHAR(40) NULL,
  support_path ENUM('yes','no') NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ps_contacts (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  uri VARCHAR(255) NULL,
  expiration_time VARCHAR(40) NULL,
  qualify_frequency INT NULL,
  outbound_proxy VARCHAR(40) NULL,
  path TEXT NULL,
  user_agent VARCHAR(255) NULL,
  qualify_timeout DECIMAL(8,3) NULL,
  reg_server VARCHAR(255) NULL,
  authenticate_qualify ENUM('yes','no') NULL,
  via_addr VARCHAR(40) NULL,
  via_port INT NULL,
  call_id VARCHAR(255) NULL,
  endpoint VARCHAR(40) NULL,
  prune_on_boot ENUM('yes','no') NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
