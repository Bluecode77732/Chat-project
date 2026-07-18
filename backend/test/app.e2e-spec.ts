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

  // No DB/Redis seed data required — this only confirms the full app boots and
  // routes dispatch to the right controller/guard chain. Each case below was
  // picked specifically because it short-circuits before any DB/Redis access.
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
