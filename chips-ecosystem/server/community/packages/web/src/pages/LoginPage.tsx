/**
 * 登录页（`pages/` 登录页，路由 `/login`，《14 设计》§7.2）：
 * `identifier` 接受邮箱或用户名（契约 §3.2）；已登录访问由路由守卫重定向。
 */

import { useState, type FormEvent, type ReactNode } from 'react';

import { useSession } from '../contexts/SessionContext';
import { getErrorMessage } from '../lib/format';
import { getPostAuthPath } from '../lib/routes';
import { Link, useNavigate, useRouterLocation } from '../lib/router';
import './auth.css';

export default function LoginPage(): ReactNode {
  const { login } = useSession();
  const navigate = useNavigate();
  const { state } = useRouterLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (identifier.trim().length === 0 || password.length === 0) {
      setError('请输入登录标识与密码');
      return;
    }
    const fromPath = (state as { from?: { pathname?: string } } | null)?.from?.pathname;
    setError('');
    setSubmitting(true);
    login(identifier.trim(), password)
      .then((user) => {
        navigate(getPostAuthPath(user, fromPath), { replace: true });
      })
      .catch((caught: unknown) => {
        setError(getErrorMessage(caught, '登录失败，请稍后重试'));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="ccw-page ccw-auth">
      <section className="ccw-panel ccw-auth__card">
        <div className="ccw-auth__head">
          <span className="ccw-eyebrow">薯片社区</span>
          <h1>欢迎回来</h1>
          <p className="ccw-muted">登录后按账号身份自动进入个人主页或管理员后台。</p>
        </div>

        {error.length > 0 ? (
          <p className="ccw-alert ccw-alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="ccw-auth__form" onSubmit={handleSubmit} noValidate>
          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-login-identifier">
              登录标识
            </label>
            <input
              id="ccw-login-identifier"
              className="ccw-form-field__input"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="邮箱或用户名"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-login-password">
              密码
            </label>
            <input
              id="ccw-login-password"
              className="ccw-form-field__input"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="ccw-button ccw-button--primary ccw-button--block"
            disabled={submitting}
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="ccw-auth__footer">
          还没有账号？ <Link to="/register">去注册</Link>
        </p>
      </section>
    </div>
  );
}
