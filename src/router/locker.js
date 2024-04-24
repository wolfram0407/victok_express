import dayjs from "dayjs";
import express from "express";
import { body, query } from "express-validator";
import { db } from "../db/database.js";
import { isAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();
// 락카 구분 등록
router.post(
  "/type/create",
  isAuth,
  [
    body("lockerName").trim().notEmpty().withMessage("라커 이름을 입력해 주세요."),
    body("lockerAmount").trim().notEmpty().withMessage("라커 개수를 입력해 주세요."),
    body("startNumber").trim().notEmpty().withMessage("시작 번호를 입력해 주세요."),
    body("talkDay").isLength({ min: 1 }).withMessage("알림주기를 설정해 주세요."),
    body("charge").isLength({ min: 1 }).withMessage("요금제를 등록해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerName, lockerAmount, startNumber, talkDay, charge, exceptNumber = [] } = req.body;
    try {
      // 락카 이름 중복 확인
      console.log("req.authorizedUser", req.authorizedUser);
      const checkLockerName = await db
        .execute(`SELECT idx FROM locker_type WHERE user_idx=? && locker_name=? &&deleted_time IS NULL`, [req.authorizedUser, lockerName])
        .then((result) => result[0][0]);

      console.log(checkLockerName);
      if (checkLockerName) {
        return res.status(409).json({
          message: "라커 구분명이 중복됩니다.",
        });
      }
      const result = await db.execute(
        "INSERT INTO locker_type (user_idx, locker_name, locker_amount, start_number, except_number, created_time) VALUES (?,?,?,?,?,?)",
        [req.authorizedUser, lockerName, lockerAmount, startNumber, exceptNumber, new Date()]
      );
      const lockerId = result[0].insertId;

      // 락카 요금 추가
      for (const i of charge) {
        console.log(i);
        await db.execute("INSERT INTO charge (locker_type_idx, period_type, period, charge, deposit) VALUES (?,?,?,?,?)", [
          Number(i.periodType),
          Number(i.period),
          Number(i.charge),
          Number(i.deposit),
        ]);
      }
      // 알림톡 날짜 추가
      for (const i of talkDay) {
        await db.execute("INSERT INTO talk_dday (user_idx, locker_type_idx, dday) VALUES (?,?,?)", [
          req.authorizedUser,
          lockerId,
          Number(i),
        ]);
      }
      return res.status(201).json({
        message: "Success",
      });
    } catch (e) {
      console.log(e);
    }
  }
);

router.put(
  "/type",
  isAuth,
  [
    body("lockerNameIdx").trim().notEmpty().withMessage("라커 타입 번호을 입력해 주세요."),
    body("lockerName").trim().notEmpty().withMessage("라커 이름을 입력해 주세요."),
    body("lockerAmount").trim().notEmpty().withMessage("라커 개수를 입력해 주세요."),
    body("startNumber").trim().notEmpty().withMessage("시작 번호를 입력해 주세요."),
    body("talkDay").isLength({ min: 1 }).withMessage("알림주기를 설정해 주세요."),
    body("charge").isLength({ min: 1 }).withMessage("요금제를 등록해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerNameIdx, lockerName, lockerAmount, startNumber, talkDay, charge, exceptNumber = [] } = req.body;
    console.log("데이터", req.authorizedUser, lockerNameIdx, lockerName, lockerAmount, startNumber, charge, talkDay, exceptNumber);

    const checkTypeName = await db
      .execute("SELECT * FROM locker_type WHERE user_idx=?&&locker_name=?&&idx!=?&&deleted_time IS NULL", [
        req.authorizedUser,
        lockerName,
        lockerNameIdx,
      ])
      .then((result) => result[0][0]);

    console.log(checkTypeName);

    if (checkTypeName) {
      return res.status(409).json({
        message: "라커 구분명이 중복됩니다.",
      });
    }
  }
);

export default router;
