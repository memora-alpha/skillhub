import { WalletOverview } from "./views/wallet-screen";
import { TransactionHistory } from "./views/transactions-screen";
import { TransactionDetail } from "./views/transaction-detail-screen";
import { TopupPreparationScreen } from "./views/topup-screen";
import { PaymentPreparationScreen } from "./views/payment-screen";
import { PaymentStatusPreparationScreen } from "./views/payment-status-screen";

export function WalletScreen() {
  return <WalletOverview />;
}
export function TopupScreen() {
  return <TopupPreparationScreen />;
}
export function PaymentScreen() {
  return <PaymentPreparationScreen />;
}
export function PaymentStatusScreen() {
  return <PaymentStatusPreparationScreen />;
}
export function TransactionsScreen() {
  return <TransactionHistory />;
}
export function TransactionDetailScreen() {
  return <TransactionDetail />;
}
