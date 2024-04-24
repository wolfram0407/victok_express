import { db } from "../db/database.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/config.js";
export function isAuth(req, res, next) {
  const authHeader = req.get("Authorization");
  // console.log(authHeader);
  if (!(authHeader && authHeader.startsWith("Bearer "))) {
    return res.status(401).json({ message: "인증 에러1(header)" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, config.jwt.secretKey, async (error, decoded) => {
    if (error) {
      return res.status(401).json({ message: "인증 에러2(token)" });
    }
    const found = await db.execute("SELECT * FROM user WHERE idx=?", [decoded.idx]).then((result) => result[0][0]);
    if (!found) {
      return res.status(401).json({ message: "인증 에러3(user)" });
    }
    req.authorizedUser = found.idx;
    req.token = token;
    next();
  });
}
