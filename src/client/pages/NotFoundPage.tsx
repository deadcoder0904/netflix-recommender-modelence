import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/Card";
import { Button } from "@/client/components/ui/Button";
import Page from "@/client/components/Page";

export default function NotFoundPage() {
  return (
    <Page>
      <div className="flex min-h-full items-center justify-center">
        <Card className="mx-auto w-full max-w-sm bg-white text-gray-900">
          <CardHeader className="text-center">
            <CardTitle className="text-6xl font-bold">404</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-8">
            <p className="text-center text-gray-600">Page not found</p>
            <Link to="/" className="w-full">
              <Button className="w-full">Go home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
