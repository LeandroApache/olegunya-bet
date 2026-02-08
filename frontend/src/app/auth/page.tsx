"use client";

import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/entities/auth";
import { gqlClient } from "@/shared/api/graphqlClient";

const schema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password too short"),
});

type FormValues = z.infer<typeof schema>;

export default function AuthPage() {
    const { login } = useAuth();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "admin@test.com",
            password: "12345678",
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const query = /* GraphQL */ `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
          }
        }
      `;

            const res = await gqlClient().request<{
                login: { accessToken: string };
            }>(query, {
                input: values,
            });

            return res.login.accessToken;
        },
        onSuccess: (token) => {
            login(token);
        },
    });

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm space-y-4">
                <div className="text-xl font-semibold text-center">Login</div>

                <form
                    className="space-y-3"
                    onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                >
                    <div className="space-y-1">
                        <label className="text-sm">Email</label>
                        <Input {...form.register("email")} />
                        {form.formState.errors.email && (
                            <div className="text-sm text-red-600">
                                {form.formState.errors.email.message}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm">Password</label>
                        <Input type="password" {...form.register("password")} />
                        {form.formState.errors.password && (
                            <div className="text-sm text-red-600">
                                {form.formState.errors.password.message}
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Signing in..." : "Sign in"}
                    </Button>

                    {mutation.isError && (
                        <div className="text-sm text-red-600 text-center">
                            {(mutation.error as any)?.response?.errors?.[0]?.message ??
                                "Login failed"}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
