import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import prisma from './lib/prisma';
import logger from './utils/logger';
import { setupSwagger } from './utils/swagger';
import { initializeOpenAI } from './utils/openai';
import apiRouter from './api';
// 移除API密钥加载导入
import adminRoutes from './admin/routes/adminRoutes';
import { pageAuthMiddleware } from './middleware/pageAuthMiddleware';
import cookieParser from 'cookie-parser';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false // 禁用CSP以允许内联脚本
}));
// 仅对非文件上传路由使用JSON解析器
app.use(/^\/(?!api\/knowledge\/upload).*/i, express.json({ limit: '50mb' }));
app.use(cookieParser()); // 添加cookie解析器，用于读取认证令牌

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 增加URL编码的请求体大小限制
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 设置API文档
setupSwagger(app);

// 集中的API路由
app.use('/api', apiRouter);

// 管理后台API路由
app.use('/api/admin', adminRoutes);

// 测试文件上传的简单端点
app.post('/api/test-upload', (req: any, res: any) => {
  try {
    if (!req.file) {
      logger.error('测试上传失败: 未提供文件');
      return res.status(400).json({ error: '未提供文件' });
    }
    
    logger.info(`测试上传成功: ${req.file.originalname}, 路径: ${req.file.path}`);
    return res.status(200).json({ 
      success: true, 
      message: '文件上传成功', 
      file: {
        name: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error: any) {
    logger.error(`测试上传错误: ${error.message}`);
    return res.status(500).json({ error: `上传失败: ${error.message}` });
  }
});

// 页面路由
// 注意：简单聊天和流式聊天页面已移除
// 请使用知识库聊天功能

// 知识库聊天页面 - 需要登录才能访问
app.get('/knowledge-chat', pageAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'knowledge-chat.html'));
});

app.get('/test-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-upload.html'));
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API文档路由
// 注意: 这个路由已由 setupSwagger 函数自动设置
// Swagger UI 可以在 /api-docs 访问
// OpenAPI JSON 规范可以在 /api-docs.json 访问

// 登录页面路由
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 默认路由
app.get('/', (req, res) => {
  res.redirect('/knowledge-chat');
});

// 404处理
app.use((req, res, next) => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: '请求的资源不存在' });
});

// 错误处理中间件
app.use((err: any, req: any, res: any, next: any) => {
  logger.error(`服务器错误: ${err.message}`);
  res.status(500).json({ error: '服务器内部错误' });
});

// 数据库连接在 ./config/database.ts 中实现

// 启动服务器
const startServer = async () => {
  try {
    // 连接到数据库
    await prisma.$connect();
    logger.info('成功连接到 PostgreSQL 数据库');
    
    // API密钥加载已移除，仅使用JWT认证
    
    // 初始化OpenAI客户端并验证连接
    await initializeOpenAI();
    
    app.listen(PORT, () => {
      logger.info(`服务器启动在 http://localhost:${PORT}`);
      logger.info(`API文档可在 http://localhost:${PORT}/api-docs 访问`);
    });
  } catch (error: any) {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  }
};

startServer();