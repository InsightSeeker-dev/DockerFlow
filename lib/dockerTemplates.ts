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
  recommendations?: {
    memory: string;
    cpu: string;
    disk: string;
  };
  tags: string[];
}

export const dockerTemplates: DockerTemplate[] = [
  {
    id: 'node-express',
    name: 'Node.js Express',
    description: 'Application Node.js avec Express et support hot-reload pour le développement',
    icon: '',
    category: 'Backend',
    difficulty: 'Beginner',
    estimatedBuildTime: '1-2 minutes',
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
  "description": "Express application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}`,
        required: true
      },
      {
        name: 'index.js',
        content: `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Express server is running!' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
        required: true
      },
      {
        name: '.dockerignore',
        content: `node_modules
npm-debug.log`,
        required: false
      }
    ],
    ports: [
      {
        container: 3000,
        host: 3000,
        description: 'Application HTTP port'
      }
    ],
    environmentVariables: [
      {
        name: 'PORT',
        description: 'Port on which the application will run',
        required: false,
        defaultValue: '3000'
      },
      {
        name: 'NODE_ENV',
        description: 'Node environment (development/production)',
        required: false,
        defaultValue: 'development'
      }
    ],
    buildArgs: [],
    healthcheck: {
      command: 'wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1',
      interval: '30s',
      timeout: '10s',
      retries: 3
    },
    recommendations: {
      memory: '512MB',
      cpu: '1 core',
      disk: '1GB'
    },
    tags: ['node', 'express', 'javascript', 'web']
  },
  {
    id: 'python-flask',
    name: 'Python Flask',
    description: 'Application Python avec Flask et support hot-reload pour le développement',
    icon: '',
    category: 'Backend',
    difficulty: 'Beginner',
    estimatedBuildTime: '1-2 minutes',
    baseImage: 'python:3.11-slim',
    dockerfile: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["flask", "run", "--host=0.0.0.0"]`,
    defaultFiles: [
      {
        name: 'requirements.txt',
        content: `flask==3.0.0
python-dotenv==1.0.0`,
        required: true
      },
      {
        name: 'app.py',
        content: `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({"message": "Flask server is running!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0')`,
        required: true
      },
      {
        name: '.env',
        content: `FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1`,
        required: false
      }
    ],
    ports: [
      {
        container: 5000,
        host: 5000,
        description: 'Application HTTP port'
      }
    ],
    environmentVariables: [
      {
        name: 'FLASK_APP',
        description: 'Main application file',
        required: true,
        defaultValue: 'app.py'
      },
      {
        name: 'FLASK_ENV',
        description: 'Flask environment',
        required: false,
        defaultValue: 'development'
      }
    ],
    buildArgs: [],
    healthcheck: {
      command: 'wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1',
      interval: '30s',
      timeout: '10s',
      retries: 3
    },
    recommendations: {
      memory: '512MB',
      cpu: '1 core',
      disk: '1GB'
    },
    tags: ['python', 'flask', 'web']
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Application React moderne avec Vite et support HMR',
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
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}`,
        required: true
      },
      {
        name: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + Vite App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
        required: true
      },
      {
        name: 'src/main.jsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        required: true
      },
      {
        name: 'src/App.jsx',
        content: `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App`,
        required: true
      }
    ],
    ports: [
      {
        container: 80,
        host: 80,
        description: 'Application HTTP port'
      }
    ],
    environmentVariables: [
      {
        name: 'VITE_API_URL',
        description: 'Backend API URL',
        required: false,
        defaultValue: 'http://localhost:3000'
      }
    ],
    buildArgs: [],
    volumes: [
      {
        container: '/app/node_modules',
        description: 'Node modules volume for development'
      },
      {
        container: '/app/src',
        description: 'Source code volume for development'
      }
    ],
    recommendations: {
      memory: '1GB',
      cpu: '2 cores',
      disk: '2GB'
    },
    tags: ['react', 'vite', 'frontend', 'javascript', 'typescript']
  }
];
