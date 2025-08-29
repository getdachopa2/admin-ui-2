import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function TestAutomationPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Test Otomasyon Paneli</h1>
       <Card>
        <CardHeader>
          <CardTitle>n8n Test Akışları</CardTitle>
          <CardDescription>
            Bu ekrandan n8n test akışlarınızı tetikleyebilir ve sonuçlarını canlı olarak izleyebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Geliştirme aşamasında...</p>
        </CardContent>
      </Card>
    </div>
  );
}

