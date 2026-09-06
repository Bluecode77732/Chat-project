import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App boot smoke test (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // DB/Redis 시드 데이터 없이 앱 전체가 부팅되고 라우팅이 올바른 컨트롤러/가드
  // 체인으로 이어지는지만 확인함 — 아래 케이스는 전부 DB/Redis 접근 전에
  // short-circuit되는 것만 골랐음.
  it('/auth/token/refreshaccess (POST) without a refresh cookie returns 401', () => {
    return request(app.getHttpServer())
      .post('/auth/token/refreshaccess')
      .expect(401);
  });

  it('/health (GET) returns 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200, { status: 'ok' });
  });

  it('/user (GET) without an Authorization header returns 401', () => {
    return request(app.getHttpServer()).get('/user').expect(401);
  });

  it('/auth/register (POST) with a malformed Authorization header returns 400', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', 'Bearer not-a-basic-token')
      .expect(400);
  });
});
