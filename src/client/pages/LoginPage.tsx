import React, { useCallback } from "react";
import { getConfig, loginWithPassword } from "modelence/client";
import { Button } from "@/client/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/client/components/ui/Card";
import { Input } from "@/client/components/ui/Input";
import { Label } from "@/client/components/ui/Label";
import { Link } from "react-router-dom";
import Page from "@/client/components/Page";

export default function LoginPage() {
  return (
    <Page>
      <div className="flex min-h-full items-center justify-center">
        <LoginForm />
      </div>
    </Page>
  );
}

function LoginForm() {
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    await loginWithPassword({ email, password });
  }, []);

  return (
    <Card className="mx-auto w-full max-w-sm bg-white">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign in to your account</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email" className="mb-2 block">
              Email
            </Label>
            <Input
              type="email"
              name="email"
              id="email"
              defaultValue={getConfig("example.modelenceDemoUsername") as string | undefined}
              required
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {/* <Link
                to="reset-password"
                className="text-sm text-gray-600"
              >
                Forgot your password?
              </Link> */}
            </div>
            <Input
              type="password"
              name="password"
              id="password"
              defaultValue={getConfig("example.modelenceDemoPassword") as string | undefined}
              required
            />
          </div>

          <Button className="w-full" type="submit">
            Login
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-gray-900 underline hover:no-underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
