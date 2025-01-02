export interface DockerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'Backend' | 'Frontend' | 'Database' | 'DevOps' | 'Other';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedBuildTime: string;
  baseImage: string;
  dockerfile: string;
  recommendations?: {
    memory?: string;
    cpu?: string;
    storage?: string;
    notes?: string[];
  };
  defaultFiles: {
    name: string;
    content: string;
    description?: string;
    required: boolean;
  }[];
  ports: {
    container: number;
    host: number;
    description: string;
  }[];
  environmentVariables: {
    name: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }[];
  buildArgs: {
    name: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }[];
  healthcheck?: {
    command: string;
    interval: string;
    timeout: string;
    retries: number;
  };
  volumes?: {
    container: string;
    description: string;
  }[];
  tags: string[];
}

export const dockerTemplates: DockerTemplate[] = [
  {
    id: 'node-express',
    name: 'Node.js Express',
    description: 'Application Node.js avec Express et support pour API REST',
    icon: '',
    category: 'Backend',
    difficulty: 'Beginner',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'node:18-alpine',
    dockerfile: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`,
    defaultFiles: [
      {
        name: 'package.json',
        content: `{
  "name": "express-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}`,
        required: true
      },
      {
        name: 'index.js',
        content: `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
        required: true
      }
    ],
    ports: [
      {
        container: 3000,
        host: 3000,
        description: 'API HTTP'
      }
    ],
    environmentVariables: [
      {
        name: 'PORT',
        description: 'Port du serveur',
        required: false,
        defaultValue: '3000'
      }
    ],
    buildArgs: [],
    tags: ['node', 'express', 'api', 'rest']
  },
  {
    id: 'python-fastapi',
    name: 'Python FastAPI',
    description: 'API REST moderne avec FastAPI et documentation Swagger intégrée',
    icon: '',
    category: 'Backend',
    difficulty: 'Beginner',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'python:3.11-slim',
    dockerfile: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,
    defaultFiles: [
      {
        name: 'requirements.txt',
        content: `fastapi==0.104.1
uvicorn==0.24.0`,
        required: true
      },
      {
        name: 'main.py',
        content: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    description: str = None

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/items/")
def create_item(item: Item):
    return item`,
        required: true
      }
    ],
    ports: [
      {
        container: 8000,
        host: 8000,
        description: 'API HTTP'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['python', 'fastapi', 'api', 'swagger']
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Application React moderne avec Vite comme bundler',
    icon: '',
    category: 'Frontend',
    difficulty: 'Intermediate',
    estimatedBuildTime: '2-3 minutes',
    baseImage: 'node:18-alpine',
    dockerfile: `FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
    defaultFiles: [
      {
        name: 'package.json',
        content: `{
  "name": "react-vite-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.3.9"
  }
}`,
        required: true
      }
    ],
    ports: [
      {
        container: 80,
        host: 80,
        description: 'Application Web'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['react', 'vite', 'frontend', 'spa']
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Base de données MongoDB avec authentification',
    icon: '',
    category: 'Database',
    difficulty: 'Intermediate',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'mongo:6',
    dockerfile: `FROM mongo:6
COPY init-mongo.js /docker-entrypoint-initdb.d/
EXPOSE 27017`,
    defaultFiles: [
      {
        name: 'init-mongo.js',
        content: `db.createUser({
  user: 'admin',
  pwd: 'password',
  roles: [{ role: 'readWrite', db: 'mydb' }]
});`,
        required: true
      }
    ],
    ports: [
      {
        container: 27017,
        host: 27017,
        description: 'MongoDB'
      }
    ],
    environmentVariables: [
      {
        name: 'MONGO_INITDB_ROOT_USERNAME',
        description: 'Nom utilisateur admin',
        required: true,
        defaultValue: 'admin'
      },
      {
        name: 'MONGO_INITDB_ROOT_PASSWORD',
        description: 'Mot de passe admin',
        required: true,
        defaultValue: 'password'
      }
    ],
    buildArgs: [],
    tags: ['mongodb', 'database', 'nosql']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Base de données PostgreSQL avec initialisation personnalisée',
    icon: '',
    category: 'Database',
    difficulty: 'Intermediate',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'postgres:15-alpine',
    dockerfile: `FROM postgres:15-alpine
COPY init.sql /docker-entrypoint-initdb.d/
EXPOSE 5432`,
    defaultFiles: [
      {
        name: 'init.sql',
        content: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
        required: true
      }
    ],
    ports: [
      {
        container: 5432,
        host: 5432,
        description: 'PostgreSQL'
      }
    ],
    environmentVariables: [
      {
        name: 'POSTGRES_USER',
        description: 'Nom utilisateur',
        required: true,
        defaultValue: 'postgres'
      },
      {
        name: 'POSTGRES_PASSWORD',
        description: 'Mot de passe',
        required: true,
        defaultValue: 'postgres'
      },
      {
        name: 'POSTGRES_DB',
        description: 'Nom de la base de données',
        required: true,
        defaultValue: 'mydb'
      }
    ],
    buildArgs: [],
    tags: ['postgresql', 'database', 'sql']
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Cache Redis avec configuration personnalisée',
    icon: '',
    category: 'Database',
    difficulty: 'Beginner',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'redis:7-alpine',
    dockerfile: `FROM redis:7-alpine
COPY redis.conf /usr/local/etc/redis/redis.conf
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
EXPOSE 6379`,
    defaultFiles: [
      {
        name: 'redis.conf',
        content: `bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""
databases 16
always-show-logo yes
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./
replica-serve-stale-data yes
replica-read-only yes
repl-diskless-sync no
repl-diskless-sync-delay 5
repl-disable-tcp-nodelay no
replica-priority 100
maxmemory 128mb
maxmemory-policy allkeys-lru`,
        required: true
      }
    ],
    ports: [
      {
        container: 6379,
        host: 6379,
        description: 'Redis'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['redis', 'cache', 'nosql']
  },
  {
    id: 'nginx-static',
    name: 'Nginx Static',
    description: 'Serveur web Nginx pour contenu statique avec configuration personnalisée',
    icon: '',
    category: 'DevOps',
    difficulty: 'Beginner',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'nginx:alpine',
    dockerfile: `FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY . /usr/share/nginx/html
EXPOSE 80`,
    defaultFiles: [
      {
        name: 'nginx.conf',
        content: `user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;
    server {
        listen       80;
        server_name  localhost;
        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
            try_files $uri $uri/ /index.html;
        }
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   /usr/share/nginx/html;
        }
    }
}`,
        required: true
      },
      {
        name: 'index.html',
        content: `<!DOCTYPE html>
<html>
<head>
    <title>Welcome</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>Welcome to Nginx</h1>
    <p>If you see this page, the nginx web server is successfully installed and working.</p>
</body>
</html>`,
        required: true
      }
    ],
    ports: [
      {
        container: 80,
        host: 80,
        description: 'HTTP'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['nginx', 'web-server', 'static']
  },
  {
    id: 'go-fiber',
    name: 'Go Fiber',
    description: 'API REST rapide avec Go Fiber',
    icon: '',
    category: 'Backend',
    difficulty: 'Intermediate',
    estimatedBuildTime: '1-2 minutes',
    baseImage: 'golang:1.21-alpine',
    dockerfile: `FROM golang:1.21-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main .
EXPOSE 3000
CMD ["./main"]`,
    defaultFiles: [
      {
        name: 'go.mod',
        content: `module app

go 1.21

require github.com/gofiber/fiber/v2 v2.51.0`,
        required: true
      },
      {
        name: 'main.go',
        content: `package main

import (
    "github.com/gofiber/fiber/v2"
    "log"
)

func main() {
    app := fiber.New()

    app.Get("/", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{
            "message": "Hello, World!",
        })
    })

    log.Fatal(app.Listen(":3000"))
}`,
        required: true
      }
    ],
    ports: [
      {
        container: 3000,
        host: 3000,
        description: 'API HTTP'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['go', 'fiber', 'api', 'rest']
  },
  {
    id: 'php-apache',
    name: 'PHP Apache',
    description: 'Application PHP avec Apache',
    icon: '',
    category: 'Backend',
    difficulty: 'Beginner',
    estimatedBuildTime: '< 1 minute',
    baseImage: 'php:8.2-apache',
    dockerfile: `FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql
COPY . /var/www/html/
EXPOSE 80`,
    defaultFiles: [
      {
        name: 'index.php',
        content: `<?php
phpinfo();`,
        required: true
      }
    ],
    ports: [
      {
        container: 80,
        host: 80,
        description: 'HTTP'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['php', 'apache', 'web']
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Application Next.js avec support SSR',
    icon: '',
    category: 'Frontend',
    difficulty: 'Intermediate',
    estimatedBuildTime: '2-3 minutes',
    baseImage: 'node:18-alpine',
    dockerfile: `FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]`,
    defaultFiles: [
      {
        name: 'package.json',
        content: `{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "13.4.19",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}`,
        required: true
      }
    ],
    ports: [
      {
        container: 3000,
        host: 3000,
        description: 'Next.js'
      }
    ],
    environmentVariables: [],
    buildArgs: [],
    tags: ['nextjs', 'react', 'ssr', 'frontend']
  }
];
