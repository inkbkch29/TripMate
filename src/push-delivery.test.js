import {it,expect,vi}from 'vitest';
import {sendWithRetry}from '../supabase/functions/send-activity-push/delivery';
it('retries transient failures then reports success once',async()=>{const send=vi.fn().mockRejectedValueOnce({statusCode:503}).mockResolvedValueOnce('ok'),delay=vi.fn();expect(await sendWithRetry(send,delay)).toBe('ok');expect(send).toHaveBeenCalledTimes(2);expect(delay).toHaveBeenCalledWith(250);});
it('does not retry expired subscriptions',async()=>{const e={statusCode:410},send=vi.fn().mockRejectedValue(e);await expect(sendWithRetry(send,vi.fn())).rejects.toBe(e);expect(send).toHaveBeenCalledTimes(1);});
it('bounds retries for offline or rate-limited endpoints',async()=>{const e={statusCode:429},send=vi.fn().mockRejectedValue(e);await expect(sendWithRetry(send,vi.fn())).rejects.toBe(e);expect(send).toHaveBeenCalledTimes(3);});
