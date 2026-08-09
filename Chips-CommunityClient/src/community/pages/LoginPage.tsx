import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input } from "antd";
import { useAuth } from "../contexts/AuthContext";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { isNetworkError } from "../api/client";
import { getErrorMessage, getPostAuthPath } from "../lib/ui";
import "./AuthForm.css";

interface LoginFormValues {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { t } = useAppPreferences();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (values: LoginFormValues) => {
    if (!values.username || !values.password) {
      setError(t("auth.validation.required"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const profile = await login(values.username, values.password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(getPostAuthPath(profile, from), { replace: true });
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
          <h1>{t("auth.loginTitle")}</h1>
          <p className="muted">{t("auth.loginSubtitle")}</p>
        </div>

        {error ? <Alert type="error" message={error} showIcon /> : null}

        <Form<LoginFormValues> layout="vertical" className="auth-form" disabled={loading} onFinish={(values) => void handleSubmit(values)}>
          <Form.Item name="username" label={t("auth.username")}>
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" label={t("auth.password")}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            {loading ? t("common.loading") : t("auth.loginAction")}
          </Button>
        </Form>

        <p className="auth-card__footer">
          {t("auth.noAccount")} <Link to="/register">{t("auth.toRegister")}</Link>
        </p>
      </section>
    </div>
  );
}
