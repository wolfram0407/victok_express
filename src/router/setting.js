import express from "express";
import { body, param } from "express-validator";

import { isAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { db } from "../../db";

const router = express.Router();

/*
로그인 된 이용자가 시정 정보 조회 및 수정
*/
router.get("/store-info", isAuth, async (req, res, next) => {
  console.log("store info");
});

router.put("/store-info", isAuth, async (req, res, next) => {
  console.log("store info2");
});

export default router;
