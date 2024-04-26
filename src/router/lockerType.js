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
      for (const i in charge) {
        console.log(i + "  " + charge[i].periodType);
        await db.execute("INSERT INTO charge (locker_type_idx, period_type, period, charge, deposit,order_number) VALUES (?,?,?,?,?,?)", [
          lockerId,
          Number(charge[i].periodType),
          Number(charge[i].period),
          Number(charge[i].charge),
          Number(charge[i].deposit),
          i,
        ]);
      }
      // 알림톡 날짜 추가
      for (const i in talkDay) {
        await db.execute("INSERT INTO talk_dday (user_idx, locker_type_idx, dday,order_number) VALUES (?,?,?,?)", [
          req.authorizedUser,
          lockerId,
          Number(talkDay[i]),
          i,
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

    if (checkTypeName) {
      return res.status(409).json({
        message: "라커 구분명이 중복됩니다.",
      });
    }

    const beforeName = await db.execute("SELECT * FROM locker_type WHERE idx=?", [lockerNameIdx]).then((result) => result[0][0]);
    // 락커 수나 줄었을 때 고객 있는지 확인 필요

    // 락카 타입 수정
    await db.execute("UPDATE locker_type SET locker_name=?, locker_amount=?, start_number=?, except_number=?, updated_time=? WHERE idx=?", [
      lockerName,
      lockerAmount,
      startNumber,
      exceptNumber ? exceptNumber : null,
      new Date(),
      lockerNameIdx,
    ]);
    // 락카 요금 수정
    for (const i in charge) {
      console.log(i);
      await db.execute("UPDATE charge SET  period_type=?, period=?, charge=?, deposit=? WHERE locker_type_idx = ? && order_number = ? ", [
        Number(charge[i].periodType),
        Number(charge[i].period),
        Number(charge[i].charge),
        Number(charge[i].deposit),
        lockerNameIdx,
        i,
      ]);
    }
    // 락카 알림 날짜 수정
    for (const i in talkDay) {
      console.log(i);
      await db.execute("UPDATE talk_dday SET  dday=? WHERE locker_type_idx = ? && order_number = ? ", [
        Number(talkDay[i]),
        lockerNameIdx,
        i,
      ]);
    }
    return res.status(201).json({
      message: "Success",
    });
  }
);

// 라커 구분 목록 - 요금표 포함
router.get("/type", isAuth, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const amount = req.query.amount ?? 10;

    const list = await db
      .query(
        `SELECT locker_type.idx as idx,
        locker_type.locker_name as locker_type,
        locker_type.start_number as start_number,
        locker_type.locker_amount as locker_amount, 
        locker_type.except_number, 
        group_concat(DISTINCT talk_dday.dday SEPARATOR ' / ') as dday FROM locker_type LEFT JOIN talk_dday ON locker_type.idx=talk_dday.locker_type_idx  WHERE talk_dday.deleted_time IS NULL&&locker_type.user_idx=${
          req.authorizedUser
        }&&locker_type.deleted_time IS NULL GROUP BY locker_type.idx ORDER BY idx LIMIT ${amount} OFFSET ${amount * (page - 1)}`
      )
      .then((result) => result[0]);
    const chargeList = await Promise.all(
      list.map(async (items) => {
        const charge = await db
          .query(`SELECT idx, period, charge, deposit,period_type FROM charge WHERE locker_type_idx=? &&deleted_time IS NULL`, [items.idx])
          .then((result) =>
            result[0].map((item) => ({
              ...item,
              charge: item.charge + "원",
              period: item.period + (item.period_type == 1 ? "일" : "개월"),
              deposit: item.deposit + "원",
            }))
          );
        return { ...items, charge: charge };
      })
    );
    res.status(200).json({
      message: "success",
      data: {
        total: chargeList.length,
        chargeList,
      },
    });
  } catch (e) {
    console.log(e);
  }
});

// 락카 구분 전체 목록
router.get("/type_all", isAuth, async (req, res) => {
  try {
    const list = await db
      .query(
        `SELECT locker_type.idx as idx,
        locker_type.locker_name as locker_type,
        locker_type.start_number as start_number,
        locker_type.locker_amount as locker_amount, 
        locker_type.except_number, 
        group_concat(DISTINCT talk_dday.dday SEPARATOR ' / ') as dday FROM locker_type LEFT JOIN talk_dday ON locker_type.idx=talk_dday.locker_type_idx  WHERE talk_dday.deleted_time IS NULL&&locker_type.user_idx=${req.authorizedUser}&&locker_type.deleted_time IS NULL GROUP BY locker_type.idx ORDER BY idx `
      )
      .then((result) => result[0]);
    const chargeList = await Promise.all(
      list.map(async (items) => {
        const charge = await db
          .query(`SELECT idx, period, charge, deposit,period_type FROM charge WHERE locker_type_idx=? &&deleted_time IS NULL`, [items.idx])
          .then((result) =>
            result[0].map((item) => ({
              ...item,
              charge: item.charge + "원",
              period: item.period + (item.period_type == 1 ? "일" : "개월"),
              deposit: item.deposit + "원",
            }))
          );
        return { ...items, charge: charge };
      })
    );
    res.status(200).json({
      message: "success",
      data: {
        total: chargeList.length,
        chargeList,
      },
    });
  } catch (e) {
    console.log(e);
  }
});

// 락카 구분삭제
router.post(
  "/type/delete",
  isAuth,
  [body("idx").trim().notEmpty().withMessage("라커 타입 idx를 입력해 주세요."), validate],
  async (req, res, next) => {
    try {
      const userIdx = req.authorizedUser == 1 ? req.body.user_idx : req.authorizedUser;
      console.log(userIdx);
      const idx = req.body.idx.split(",");
      console.log(idx.toString());
      const date = dayjs().format("YYYY-MM-DD HH:mm:ss");

      // 락커 존재하는지 검증 필요

      //

      const lockerType = await db
        .execute(`SELECT locker_name FROM locker_type WHERE idx IN(${idx.toString()})`)
        .then((result) => result[0][0]);

      // 락카 삭제 진행 필요

      // 락카 타입 삭제
      await db.execute(`UPDATE locker_type SET deleted_time='${date}' WHERE idx IN(${idx})`);
      return res.status(204).json({
        message: "success",
      });
    } catch (e) {
      console.log(e);
    }
  }
);

export default router;
