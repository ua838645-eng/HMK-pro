import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFareQuote,
  calculateDistanceKm,
  isValidCompanyDriverEmail,
  isValidCanadianPostalCode,
  isValidCanadianBankDetails,
  isValidCardExpiry,
  isValidPassword,
  detectCardBrand,
  recommendTierByWeight,
  validateLuhnCard,
  sanitizeCsvCell,
  buildDispatchReport,
  buildReportCsv,
  computeGamificationStats,
  parseVoiceCommand,
  type OrderRecord,
} from './logistics';

test('calculateFareQuote computes Ontario HST 13% and HMK20 promo accurately', () => {
  const q = calculateFareQuote('gta', 100, 'HMK20');
  assert.equal(q.subtotal, 100);
  assert.equal(q.discount, 20);
  assert.equal(q.tax, 10.4);
  assert.equal(q.total, 90.4);
  assert.equal(q.promoCode, 'HMK20');
});

test('calculateFareQuote computes Quebec GST+QST 14.975% without promo', () => {
  const q = calculateFareQuote('montreal', 200, 'BADCODE');
  assert.equal(q.discount, 0);
  assert.equal(q.tax, 29.95);
  assert.equal(q.total, 229.95);
  assert.equal(q.promoCode, '');
});

test('isValidCompanyDriverEmail enforces @hmktrading.ca corporate domain', () => {
  assert.equal(isValidCompanyDriverEmail('marc.tremblay@hmktrading.ca'), true);
  assert.equal(isValidCompanyDriverEmail('driver1@gmail.com'), false);
  assert.equal(isValidCompanyDriverEmail('bad@@hmktrading.ca'), false);
  assert.equal(isValidCompanyDriverEmail('@hmktrading.ca'), false);
});

test('isValidPassword enforces minimum 8 characters', () => {
  assert.equal(isValidPassword('1234567'), false);
  assert.equal(isValidPassword('Hmk@2026'), true);
});

test('isValidCanadianPostalCode, bank EFT, card expiry & tier recommender work', () => {
  assert.equal(isValidCanadianPostalCode('M5V 3L9'), true);
  assert.equal(isValidCanadianPostalCode('12345'), false);
  assert.equal(isValidCanadianBankDetails('003', '12345', '123456789'), true);
  assert.equal(isValidCanadianBankDetails('03', '1234', '123'), false);
  assert.equal(isValidCardExpiry('12/29'), true);
  assert.equal(isValidCardExpiry('01/20'), false);
  assert.equal(detectCardBrand('4242 4242'), 'Visa');
  assert.equal(detectCardBrand('5412 0000'), 'Mastercard');
  assert.equal(recommendTierByWeight(120), 'suv');
  assert.equal(recommendTierByWeight(700), 'van');
  assert.equal(recommendTierByWeight(1800), 'cube');
  assert.equal(recommendTierByWeight(3500), 'truck');
});

test('validateLuhnCard validates standard test card numbers', () => {
  assert.equal(validateLuhnCard('4242 4242 4242 4242'), true);
  assert.equal(validateLuhnCard('4242 4242 4242 4243'), false);
  assert.equal(validateLuhnCard('1234'), false);
});

test('sanitizeCsvCell neutralizes spreadsheet formula injection', () => {
  assert.equal(sanitizeCsvCell('=CMD("calc")'), '"\'=CMD(""calc"")"');
  assert.equal(sanitizeCsvCell('+SUM(A1)'), '"\'+SUM(A1)"');
  assert.equal(sanitizeCsvCell('Toronto Hub'), '"Toronto Hub"');
});

test('calculateDistanceKm stays bounded and deterministic', () => {
  const km = calculateDistanceKm('gta', 'Scarborough Centre', 'Brampton Hub');
  assert.ok(km >= 8 && km <= 31);
});

test('buildDispatchReport and buildReportCsv aggregate orders cleanly', () => {
  const sample: OrderRecord[] = [
    {
      id: 'HMK-10001',
      pin: '1234',
      hubKey: 'gta',
      tierKey: 'van',
      hub: 'Greater Toronto Area (ON)',
      tier: 'Cargo Van',
      pk: 'Toronto Downtown Hub',
      dp: 'Mississauga City Centre',
      pa: '120 King St W',
      da: '45 Main St',
      sub: 100,
      disc: 0,
      tax: 13,
      total: 113,
      taxLabel: 'HST 13%',
      promoCode: '',
      pm: 'Wallet',
      ps: 'Settled',
      status: 'Delivered',
      log: [],
      km: 12,
      driver: 'Marc Tremblay',
      driverEmail: 'marc@hmktrading.ca',
      rn: 'Alice',
      rp: '4165550192',
      nt: '',
      when: '',
      owner: 'alice@example.com',
      at: '2026-11-21',
      createdAtIso: new Date().toISOString(),
      rev: 'Fast',
      rate: 5,
      rated: true,
      dis: '',
      msgs: [],
    },
    {
      id: 'HMK-10002',
      pin: '5678',
      hubKey: 'calgary',
      tierKey: 'suv',
      hub: 'Calgary (AB)',
      tier: 'Courier SUV',
      pk: 'Calgary Downtown',
      dp: 'Airdrie Hub',
      pa: '',
      da: '',
      sub: 50,
      disc: 0,
      tax: 2.5,
      total: 52.5,
      taxLabel: 'GST 5%',
      promoCode: '',
      pm: 'Wallet',
      ps: 'Refunded',
      status: 'Cancelled',
      log: [],
      km: 10,
      driver: 'Devon Miller',
      rn: 'Bob',
      rp: '4035550100',
      nt: '',
      when: '',
      owner: 'bob@example.com',
      at: '2026-11-21',
      createdAtIso: new Date().toISOString(),
      rev: '',
      rate: 5,
      dis: '',
      msgs: [],
    },
  ];
  const rep = buildDispatchReport(sample, 'Daily');
  assert.equal(rep.totalOrders, 2);
  assert.equal(rep.deliveredOrders, 1);
  assert.equal(rep.cancelledOrders, 1);
  assert.equal(rep.grossVolumeCad, 113);
  assert.equal(rep.totalTaxCad, 13);
  assert.equal(rep.byTier[0]?.tier, 'Cargo Van');

  const csvOut = buildReportCsv(rep);
  assert.ok(csvOut.includes('84920 1948 RT0001'));
  assert.ok(csvOut.includes('113.00'));

  const gami = computeGamificationStats(sample, 'marc@hmktrading.ca', 'driver', 3);
  assert.equal(gami.dailyCompleted, 1);
  assert.equal(gami.xp, 210);
  assert.equal(gami.badges.find((b) => b.id === 'five_star')?.earned, true);
});

test('parseVoiceCommand maps natural spoken instructions to actions', () => {
  assert.deepEqual(parseVoiceCommand('Open booking'), {type: 'navigate', target: 'book'});
  assert.deepEqual(parseVoiceCommand('Track order HMK-54321'), {type: 'track_order', orderId: 'HMK-54321'});
  assert.deepEqual(parseVoiceCommand('Switch to French'), {type: 'lang', lang: 'fr'});
  assert.deepEqual(parseVoiceCommand('Download CSV'), {type: 'export_csv'});
});
