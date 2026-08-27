import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage, getPostAuthPath } from '../lib/ui';
import './AuthForm.css';

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: RegisterFormValues) => {
    const { username, password, confirmPassword } = values;

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    if (username.length < 3 || username.length > 32) {
      setError('用户名长度必须在 3 到 32 个字符之间');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('用户名只能包含字母、数字、下划线和连字符');
      return;
    }

    if (password.length < 8) {
      setError('密码长度至少为 8 位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const profile = await register(username, password);
      navigate(getPostAuthPath(profile), { replace: true });
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
          <h1>创建社区账号</h1>
          <p className="muted">注册后即可拥有个人社区主页与上传工作区。</p>
        </div>

        {error ? <Alert type="error" message={error} showIcon /> : null}

        <Form<RegisterFormValues>
          layout="vertical"
          className="auth-form"
          disabled={loading}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item name="username" label="用户名">
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" label="密码">
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item name="confirmPassword" label="确认密码">
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            {loading ? '加载中…' : '注册'}
          </Button>
        </Form>

        <p className="auth-card__footer">
          已经有账号了？ <Link to="/login">去登录</Link>
        </p>
      </section>
    </div>
  );
}
