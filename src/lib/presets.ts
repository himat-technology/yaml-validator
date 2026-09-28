export interface Preset {
  id: "kubernetes" | "openapi" | "docker-compose";
  label: string;
  description: string;
  content: string;
}

const kubernetes = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-api
  namespace: production
  labels:
    app.kubernetes.io/name: example-api
    app.kubernetes.io/part-of: example-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: example-api
  template:
    metadata:
      labels:
        app: example-api
    spec:
      containers:
        - name: api
          image: "example/api:1.0.0"
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: LOG_LEVEL
              value: info
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
`;

const openapi = `openapi: 3.0.3
info:
  title: Example Inventory API
  version: 1.2.0
  description: |
    Sample OpenAPI 3.0 specification for an inventory service.
    Uses placeholder hosts only.
servers:
  - url: https://api.example.com/v1
    description: Production
paths:
  /items:
    get:
      summary: List inventory items
      operationId: listItems
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        "200":
          description: A page of items
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Item"
        "401":
          $ref: "#/components/responses/Unauthorized"
  /items/{itemId}:
    get:
      summary: Get a single item
      operationId: getItem
      parameters:
        - name: itemId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: The requested item
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Item"
        "404":
          description: Item not found
components:
  schemas:
    Item:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          example: Widget
        quantity:
          type: integer
          example: 42
        discontinued:
          type: boolean
          default: false
        notes:
          type: string
          nullable: true
  responses:
    Unauthorized:
      description: Missing or invalid credentials
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
security:
  - bearerAuth: []
`;

const dockerCompose = `name: example-stack

x-default-logging: &default-logging
  driver: json-file
  options:
    max-size: 10m
    max-file: "3"

services:
  web:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    depends_on:
      - api
    logging: *default-logging
    restart: unless-stopped

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_HOST: db
      DATABASE_PORT: 5432
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging: *default-logging

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - db-data:/var/lib/postgresql/data
    secrets:
      - db_password

volumes:
  db-data: {}

secrets:
  db_password:
    file: ./secrets/db_password.txt
`;

export const PRESETS: readonly Preset[] = [
  {
    id: "kubernetes",
    label: "Kubernetes",
    description: "Deployment manifest with probes and resource limits",
    content: kubernetes,
  },
  {
    id: "openapi",
    label: "OpenAPI 3.0",
    description: "Inventory API specification with schemas and $refs",
    content: openapi,
  },
  {
    id: "docker-compose",
    label: "Docker Compose",
    description: "Web, API and database services with anchors and secrets",
    content: dockerCompose,
  },
];

export const DEFAULT_PRESET = PRESETS[0];
