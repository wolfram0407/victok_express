import express from "express";
import { body, param } from "express-validator";

import { isAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { db } from "../db/database.js";

const router = express.Router();

// 고객 생성
router.post(
  "/create",
  isAuth,
  [
    body("customerName").trim().notEmpty().withMessage("사용자 이름을 입력해 주세요."),
    body("customerPhone").trim().notEmpty().withMessage("사용자 휴대폰 번호를 입력해 주세요."),
    body("gender").trim().notEmpty().withMessage("성별을 입력해 주세요."),
    body("birth").trim().notEmpty().withMessage("생년월일을 입력해 주세요."),
    body("agreeMarketing").trim().notEmpty().withMessage("마케팅동의를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { customerName, customerPhone, gender, birth, memo = "", agreeMarketing } = req.body;
    console.log("customer", customerName, customerPhone, gender, birth, memo, agreeMarketing, req.authorizedUser);
    try {
      const existPhone = await db
        .execute("SELECT idx FROM customer WHERE user_idx=?&&phone= ? &&deleted_time IS NULL", [req.authorizedUser, customerPhone])
        .then((result) => result[0][0]);
      if (existPhone) {
        return res.status(409).json({
          message: `${customerPhone} 번호가 존재합니다`,
        });
      }
      const result = await db.execute(
        "INSERT INTO customer ( user_idx, name, phone, gender,birth,memo,agree_marketing ) VALUES (?,?,?,?,?,?,?)",
        [req.authorizedUser, customerName, customerPhone, gender, birth, memo, agreeMarketing ?? 0]
      );

      return res.status(201).json({
        message: "success",
        data: {
          idx: result[0].insertId,
        },
      });
    } catch (e) {
      console.log(e);
    }
  }
);

// 전체 고객 조회
router.get("/info/all", isAuth, async (req, res, next) => {
  try {
    const list = await db
      .query(`SELECT name, phone FROM customer WHERE user_idx = ? AND deleted_time IS NULL`, [req.authorizedUser])
      .then((r) => r[0]);

    console.log(list);
    return res.status(200).json({
      message: "success",
      data: {
        customer: list,
      },
    });
  } catch (e) {
    console.log(e);
  }
});

// 고객 정보 조회
router.get(
  "/info/:customerIdx",
  isAuth,
  [param("customerIdx").trim().notEmpty().withMessage("customerIdx 입력해 주세요."), validate],
  async (req, res, next) => {
    try {
      const { customerIdx } = req.params;
      const customerInfo = await db
        .execute(`SELECT idx, name, phone, gender, birth, memo, user_idx, agree_marketing FROM customer WHERE idx= ?  && user_idx = ?`, [
          customerIdx,
          req.authorizedUser,
        ])
        .then((result) => result[0][0]);
      if (!customerInfo) {
        return res.status(404).json({ message: "해당 회원이 존재하지 않습니다." });
      }

      return res.json({
        message: "success",
        data: {
          customerInfo,
        },
      });
    } catch (e) {
      console.log(e);
    }
  }
);

router.put(
  "/info/:customerIdx",
  isAuth,
  [
    body("customerName").trim().notEmpty().withMessage("사용자 이름을 입력해 주세요."),
    body("customerPhone").trim().notEmpty().withMessage("사용자 휴대폰 번호를 입력해 주세요."),
    body("gender").trim().notEmpty().withMessage("성별을 입력해 주세요."),
    body("birth").trim().notEmpty().withMessage("생년월일을 입력해 주세요."),
    body("agreeMarketing").trim().notEmpty().withMessage("마케팅동의를 입력해 주세요."),
    body("memo").trim().optional(),
    validate,
  ],
  async (req, res, next) => {
    const { customerIdx } = req.params;
    const { customerName, customerPhone, gender, birth, memo, agreeMarketing } = req.body;
    // customer find
    const store = await db
      .query(`SELECT * FROM customer WHERE idx=? && user_idx=? &&deleted_time IS NULL`, [customerIdx, req.authorizedUser])
      .then((result) => result[0][0]);

    if (!store) {
      return res.status(404).json({
        message: "not found",
      });
    }
    // 변경되는 부분 체크
    const entries = Object.entries({
      name: customerName !== store.name ? customerName : null,
      phone: customerPhone !== store.phone ? customerPhone : null,
      gender: gender !== store.gender ? gender : null,
      birth: birth !== store.birth ? birth : null,
      memo: memo !== store.memo ? memo : null,
      agree_marketing: Number(agreeMarketing) !== store.agree_marketing ? agreeMarketing : null,
    }).filter(([_, v]) => v != null);

    //새로 입력한 번호가 기존 유저와 중복이 되는 경우 체크
    if (store.phone !== customerPhone) {
      const checkPhone = await db
        .execute("select idx from customer where phone=? &&deleted_time IS NULL", [customerPhone])
        .then((result) => result[0][0]);
      if (checkPhone) {
        return res.status(409).json({
          message: "phoneNumber is exist",
        });
      }
    }
    if (!entries) {
      await db
        .execute(`UPDATE customer SET ${entries.map(([k]) => `${k}=?`).join(", ")} where idx =? &&deleted_time IS NULL`, [
          ...entries.map(([_, v]) => v),
          customerIdx,
        ])
        .then((result) => result[0][0]);
    }

    return res.status(201).json({
      message: "success",
    });
  }
);

router.delete(
  "/delete",
  isAuth,
  [body("idx").isLength({ min: 1 }).withMessage("customer_idx를 입력해 주세요."), validate],
  async (req, res, next) => {
    const { idx } = req.body;

    for (const i of idx) {
      const checkCustomer = await db
        .execute("SELECT * FROM customer where idx=? && deleted_time IS NULL && user_idx=?", [i, req.authorizedUser])
        .then((result) => result[0][0]);
      if (!checkCustomer) {
        return res.status(404).json({
          message: "해당 유저가 없습니다",
        });
      }
      await db.execute("UPDATE customer SET deleted_time=? WHERE idx=?", [new Date(), i]);
    }
    return res.status(200).json({
      message: "success",
    });
  }
);

router.post(
  "/check-phone",
  isAuth,
  [body("customerPhone").notEmpty().withMessage("폰넘버 넣어주세요"), validate],
  async (req, res, next) => {
    console.log(req.body.customerPhone);
    const checkPhoneNumber = await db
      .execute("Select idx from customer where phone =? && user_idx = ? && deleted_time IS NULL", [
        req.body.customerPhone,
        req.authorizedUser,
      ])
      .then((result) => result[0][0]);
    if (checkPhoneNumber) {
      return res.status(409).json({ message: "동일한 번호를 사용 중인 회원이 이미 존재합니다." });
    }
    return res.status(200).json({
      message: "사용 가능합니다.",
    });
  }
);
export default router;
