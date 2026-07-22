"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

type Stat = { label: string; value: string; highlight?: boolean };

export default function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <div className={`grid gap-4 ${stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          <Card
            className={
              s.highlight
                ? "border-yellow-400 bg-yellow-50"
                : "border-green-100"
            }
          >
            <CardContent className="py-5">
              <p className="text-base text-muted-foreground sm:text-lg">{s.label}</p>
              <p className="mt-1 text-4xl font-bold text-green-900 sm:text-5xl">
                {s.value}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
