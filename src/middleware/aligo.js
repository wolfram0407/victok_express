import axios from "axios";
import { config } from "../../config/config.js";
import FormData from "form-data";

// 인증 문자 발송
export async function smsPush(phone, number) {
  try {
    console.log(phone, number);
    const smsText = `[빅톡] 인증번호[${number}]를 입력해주세요`;
    const form = new FormData();
    form.append("key", config.aligo.key);
    form.append("user_id", config.aligo.id);
    form.append("sender", config.aligo.sender);
    form.append("receiver", phone);
    form.append("msg", smsText);
    form.append("msg_type", "SMS");
    const formHeaders = form.getHeaders();
    const res = await axios.post("https://apis.aligo.in/send/", form, {
      headers: { ...formHeaders, "Content-Length": form.getLengthSync() },
    });
  } catch (error) {
    console.log(error);
  }
}
