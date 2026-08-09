import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input } from "antd";
import { useAuth } from "../contexts/AuthContext";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { isNetworkError } from "../api/client";
import { getErrorMessage, getPostAuthPath } from "../lib/ui";
import "./AuthForm.css";

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const { t } = useAppPreferences();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: RegisterFormValues) => {
    const { username, password, confirmPassword } = values;

    if (!username || !password) {
      setError(t("auth.validation.required"));
      return;
    }

    if (username.length < 3 || username.length > 32) {
      setError(t("auth.validation.usernameLength"));
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError(t("auth.validation.usernamePattern"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.validation.passwordLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.validation.passwordMismatch"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const profile = await register(username, password);
      navigate(getPostAuthPath(profile), { replace: true });
    } catch (nextError) {
      setError(
        isNetworkError(nextError)
          ? t("common.networkError")
          : getErrorMessage(nextError, t("common.error")),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <section className="panel auth-card">
        <div className="auth-card__top">
          <span className="eyebrow">{t("brand.name")}</span>
          <h1>{t("auth.registerTitle")}</h1>
          <p className="muted">{t("auth.registerSubtitle")}</p>
        </div>

        {error ? <Alert type="error" message={error} showIcon /> : null}

        <Form<RegisterFormValues> layout="vertical" className="auth-form" disabled={loading} onFinish={(values) => void handleSubmit(values)}>
          <Form.Item name="username" label={t("auth.username")}>
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" label={t("auth.password")}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item name="confirmPassword" label={t("auth.confirmPassword")}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            {loading ? t("common.loading") : t("auth.registerAction")}
          </Button>
        </Form>

        <p className="auth-card__footer">
          {t("auth.hasAccount")} <Link to="/login">{t("auth.toLogin")}</Link>
        </p>
      </section>
    </div>
  );
}
