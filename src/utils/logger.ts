import winston from "winston";
import {config} from "@/config";

const {combine, timestamp, errors, json, colorize, simple} = winston.format;

const developmentFormat = combine(
    colorize(),
    timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    errors({stack: true}),
    simple()
);

const productionFormat = combine(
    timestamp(),
    errors({stack: true}),
    json()
);

export const logger = winston.createLogger({
    level: config.logging.level,
    format: config.env === 'production' ? productionFormat : developmentFormat,
    defaultMeta: {service: 'category-api'},
    transports: [
        new winston.transports.Console(),
        ...(config.env === 'production'
            ? [
                new winston.transports.File({filename: 'logs/error.log', level: 'error'}),
                new winston.transports.File({filename: 'logs/combined.log'}),
            ]
            : []),
    ],
});