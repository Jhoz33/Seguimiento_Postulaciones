import { getApplications, saveApplications } from '../../lib/storage';
import { randomUUID } from 'crypto';

export async function GET() {
  const apps = getApplications();
  return new Response(JSON.stringify(apps), { headers: { 'Content-Type': 'application/json' } });
}

export async function POST(request) {
  const body = await request.json();
  const apps = getApplications();
  const newApp = { ...body, id: randomUUID(), createdAt: new Date().toISOString() };
  apps.push(newApp);
  saveApplications(apps);
  return new Response(JSON.stringify(newApp), { headers: { 'Content-Type': 'application/json' } });
}

export async function PUT(request) {
  const { id, ...data } = await request.json();
  const apps = getApplications();
  const index = apps.findIndex(app => app.id === id);
  if (index > -1) {
    apps[index] = { ...apps[index], ...data };
    saveApplications(apps);
    return new Response(JSON.stringify(apps[index]), { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

export async function DELETE(request) {
  const { id } = await request.json();
  const apps = getApplications();
  const index = apps.findIndex(app => app.id === id);
  if (index > -1) {
    const deleted = apps[index];
    apps.splice(index, 1);
    saveApplications(apps);
    return new Response(JSON.stringify(deleted), { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}