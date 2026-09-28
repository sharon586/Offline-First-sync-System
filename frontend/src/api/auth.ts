import apiClient from "./client";
import type { User } from "../types";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login", { username, password }).then((r) => r.data),

  register: (data: { username: string; email: string; password: string; full_name?: string }) =>
    apiClient.post<User>("/auth/register", data).then((r) => r.data),

  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),

  updateProfile: (data: { full_name?: string; email?: string }) =>
    apiClient.put<User>("/auth/me", data).then((r) => r.data),
};
