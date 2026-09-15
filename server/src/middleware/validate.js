import ApiError from '../utils/ApiError.js';
import { isValidObjectId } from '../utils/mongo.js';

/** Parses and replaces `req.body` with the validated value. Zod errors go to the error handler. */
export const validateBody = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};

/** Ensures the named route params are well-formed ObjectIds before they reach the DB. */
export const validateObjectIdParams = (...names) => (req, _res, next) => {
  for (const name of names) {
    if (!isValidObjectId(req.params[name])) throw ApiError.badRequest(`Invalid ${name}`);
  }
  next();
};
