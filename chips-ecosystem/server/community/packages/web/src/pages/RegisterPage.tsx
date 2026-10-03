/**
 * 注册页（`pages/` 注册页，路由 `/register`，《14 设计》§7.2）：
 * 注册即建立会话（契约 §3.2）；客户端校验口径与服务端 schema 一致
 * （用户名 `/^[a-z0-9-]{3,32}$/`、口令 8–128 位）；已登录访问由路由守卫重定向。
 */

import { useState, type FormEvent, type ReactNode } from 'react';

import { useSession } from '../contexts/SessionContext';
import { getErrorMessage } from '../lib/format';
import { getPostAuthPath } from '../lib/routes';
import { Link, useNavigate } from '../lib/router';
import './auth.css';

const USERNAME_PATTERN = /^[a-z0-9-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage(): ReactNode {
  const { register } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!USERNAME_PATTERN.test(username)) {
      setError('用户名只能包含小写字母、数字与连字符，长度 3 到 32 个字符');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError('邮箱格式不合法');
      return;
    }
    if (password.length < 8) {
      setError('密码长度至少为 8 位');
      return;
    }
    if (password.length > 128) {
      setError('密码长度至多 128 个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setError('');
    setSubmitting(true);
    register({ username, email, password })
      .then((user) => {
        navigate(getPostAuthPath(user), { replace: true });
      })
      .catch((caught: unknown) => {
        setError(getErrorMessage(caught, '注册失败，请稍后重试'));
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
          <h1>创建社区账号</h1>
          <p className="ccw-muted">注册后即拥有个人社区主页，作品发布经薯片客户端完成。</p>
        </div>

        {error.length > 0 ? (
          <p className="ccw-alert ccw-alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="ccw-auth__form" onSubmit={handleSubmit} noValidate>
          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-register-username">
              用户名
            </label>
            <input
              id="ccw-register-username"
              className="ccw-form-field__input"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="小写字母、数字与连字符"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-register-email">
              邮箱
            </label>
            <input
              id="ccw-register-email"
              className="ccw-form-field__input"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-register-password">
              密码
            </label>
            <input
              id="ccw-register-password"
              className="ccw-form-field__input"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ccw-form-field">
            <label className="ccw-form-field__label" htmlFor="ccw-register-confirm">
              确认密码
            </label>
            <input
              id="ccw-register-confirm"
              className="ccw-form-field__input"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="ccw-button ccw-button--primary ccw-button--block"
            disabled={submitting}
          >
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="ccw-auth__footer">
          已经有账号了？ <Link to="/login">去登录</Link>
        </p>
      </section>
    </div>
  );
}
