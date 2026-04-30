import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  BACKEND_PORT: Joi.number().default(3001),
  PUBLIC_APP_URL: Joi.string().uri().required(),

  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  ENCRYPTION_MASTER_KEY: Joi.string().length(64).hex().required(),

  ASTERISK_HOST: Joi.string().required(),
  ASTERISK_AMI_PORT: Joi.number().default(5038),
  ASTERISK_AMI_USER: Joi.string().required(),
  ASTERISK_AMI_PASSWORD: Joi.string().required(),
  ASTERISK_ARI_PORT: Joi.number().default(8088),
  ASTERISK_ARI_USER: Joi.string().required(),
  ASTERISK_ARI_PASSWORD: Joi.string().required(),
  ASTERISK_ARI_APP: Joi.string().default('callcenter-app'),

  STORAGE_DRIVER: Joi.string().valid('local', 's3', 'minio', 'wasabi', 'backblaze').default('local'),
  LOCAL_RECORDINGS_PATH: Joi.string().default('/var/recordings'),

  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),

  BOOTSTRAP_SUPERADMIN_EMAIL: Joi.string().email().required(),
  BOOTSTRAP_SUPERADMIN_PASSWORD: Joi.string().min(10).required(),
  BOOTSTRAP_SUPERADMIN_NAME: Joi.string().required(),
});
