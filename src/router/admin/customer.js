import express from "express";
import { body, param } from "express-validator";

import { isAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { db } from "../../db";

const router = express.Router();

export default router;
