import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Hoş Geldiniz!</CardTitle>
          <CardDescription>
            Test otomasyon paneline hoş geldiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Başlamak için sol menüden "Test Otomasyonu" sayfasına
            gidebilirsiniz.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

