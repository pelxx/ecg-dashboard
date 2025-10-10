"use client";

import PatientMQTTPage from "@/components/PatientMQTTPage";

export default function Page({ params }: { params: { id: string } }) {
  console.log("Route params:", params); // harus muncul { id: 'xxx' } di console
  return <PatientMQTTPage params={params} />;
}
