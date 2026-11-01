// A trip member can submit a slip for a debtor, but never to themselves.
export function canSubmitSettlement(transfer, settlement, currentUserId) {
 return Boolean(currentUserId && currentUserId !== transfer.to && (!settlement || settlement.status === 'rejected'));
}
