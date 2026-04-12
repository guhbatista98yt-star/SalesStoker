import { SqliteStorage } from './server/storage';
async function run() {
    try {
        const storage = new SqliteStorage();
        const r = await storage.getMetasAcompanhamento('10', 'semana');
        console.log(JSON.stringify(r, null, 2));
    } catch (e) {
        console.error('BIGERROR', e);
    }
}
run();
