import type { Metadata } from "next";
import { DepositPayment } from "../../../components/pay/deposit-payment";
import { approvedChatApiUrl } from "../../../lib/chat-api-url";

export const metadata: Metadata = {
  title: "Appointment deposit",
  robots: { index: false, follow: false },
};

export default function EnglishPayPage() {
  return (
    <div className="page">
      <DepositPayment
        locale="en"
        endpoint={approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL)}
      />
    </div>
  );
}
