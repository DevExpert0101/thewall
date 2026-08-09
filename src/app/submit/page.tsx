import { getWall } from "@/lib/server";
import { isFrozen } from "@/lib/wall";
import Checkout from "@/components/Checkout";
import BackNav from "@/components/BackNav";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const wall = await getWall();
  const frozen = wall ? isFrozen(wall) : true;

  return (
    <main className="flex w-full flex-1 flex-col px-4 pb-16">
      <BackNav />
      <Checkout
        frozen={frozen}
        wallTitle={wall?.title}
        endsAt={wall?.ends_at}
        createdAt={wall?.created_at}
      />
    </main>
  );
}
