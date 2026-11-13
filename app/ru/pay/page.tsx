import type { Metadata } from "next";
import { DepositPayment } from "../../../components/pay/deposit-payment";
import { approvedChatApiUrl } from "../../../lib/chat-api-url";

export const metadata: Metadata = {
  title: "Депозит за запись",
  robots: { index: false, follow: false },
};

export default function RussianPayPage() {
  return (
    <div className="page">
      <DepositPayment
        locale="ru"
        endpoint={approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL)}
      />
    </div>
  );
}
