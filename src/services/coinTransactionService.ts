import { Transaction } from 'sequelize';
import CoinTransaction, { CoinTransactionKind } from '../models/CoinTransaction';

interface LogCoinTransactionInput {
  userId: number;
  amount: number;
  kind: CoinTransactionKind;
  description?: string;
  challengeId?: number | null;
  submissionId?: number | null;
  spinHistoryId?: number | null;
}

interface LogCoinTransactionOptions {
  transaction?: Transaction;
}

export const logCoinTransaction = async (
  input: LogCoinTransactionInput,
  options: LogCoinTransactionOptions = {}
): Promise<void> => {
  await CoinTransaction.create(
    {
      userId: input.userId,
      amount: input.amount,
      kind: input.kind,
      description: input.description ?? '',
      challengeId: input.challengeId ?? null,
      submissionId: input.submissionId ?? null,
      spinHistoryId: input.spinHistoryId ?? null,
    },
    {
      transaction: options.transaction,
    }
  );
};

