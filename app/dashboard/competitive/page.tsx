import CompetitiveDashboard from "@/components/CompetitiveDashboard";

export const metadata = { title: "경쟁 인텔리전스 | Simulo" };

export default function CompetitivePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">경쟁 인텔리전스</h1>
          <p className="text-gray-400 mt-1 text-sm">
            경쟁사 앱을 야핏무브와 동일한 기준으로 분석하고 격차를 추적합니다.
          </p>
        </div>
        <CompetitiveDashboard />
      </div>
    </div>
  );
}
