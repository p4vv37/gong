import { OrdersDashboard } from "@/components/orders-dashboard";
import { DEMO_USER_ID } from "@/lib/types";
import { listOrders } from "./actions";

export default async function OrdersPage() {
  const orders = await listOrders(DEMO_USER_ID);

  return <OrdersDashboard initialOrders={orders} />;
}
