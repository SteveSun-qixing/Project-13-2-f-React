import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage, getPostAuthPath } from '../lib/ui';
import './AuthForm.css';

interface LoginFormValues {
  username: string;
  password: string;
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (values: LoginFormValues) => {
    if (!values.username || !values.password) {
      setError('请输入用户名和密码');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const profile = await login(values.username, values.password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(getPostAuthPath(profile, from), { replace: true });
    } catch (nextError) {
      setError(getErrorMessage(nextError, '出现了一点问题'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container auth-page">
      <section className="panel auth-card">
        <div className="auth-card__top">
          <span className="eyebrow">薯片社区</span>
          <h1>欢迎回来</h1>
          <p className="muted">登录后会按账号身份自动进入个人主页或管理员后台。</p>
        </div>

        {error ? <Alert type="error" message={error} showIcon /> : null}

        <Form<LoginFormValues>
          layout="vertical"
          className="auth-form"
          disabled={loading}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item name="username" label="用户名">
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" label="密码">
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            {loading ? '加载中…' : '登录'}
          </Button>
        </Form>

        <p className="auth-card__footer">
          还没有账号？ <Link to="/register">去注册</Link>
        </p>
      </section>
    </div>
  );
}
