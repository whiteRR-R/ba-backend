import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type CoinTransactionKind =
  | 'challenge_bet'
  | 'challenge_payout'
  | 'challenge_refund'
  | 'challenge_dispute_payout'
  | 'streak_reward'
  | 'spin_reward'
  | 'admin_adjustment';

interface CoinTransactionAttributes {
  id: number;
  userId: number;
  amount: number;
  kind: CoinTransactionKind;
  description: string;
  challengeId?: number | null;
  submissionId?: number | null;
  spinHistoryId?: number | null;
}

interface CoinTransactionCreationAttributes
  extends Optional<
    CoinTransactionAttributes,
    'id' | 'description' | 'challengeId' | 'submissionId' | 'spinHistoryId'
  > {}

class CoinTransaction
  extends Model<CoinTransactionAttributes, CoinTransactionCreationAttributes>
  implements CoinTransactionAttributes
{
  public id!: number;
  public userId!: number;
  public amount!: number;
  public kind!: CoinTransactionKind;
  public description!: string;
  public challengeId?: number | null;
  public submissionId?: number | null;
  public spinHistoryId?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CoinTransaction.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    kind: {
      type: DataTypes.ENUM(
        'challenge_bet',
        'challenge_payout',
        'challenge_refund',
        'challenge_dispute_payout',
        'streak_reward',
        'spin_reward',
        'admin_adjustment'
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    challengeId: { type: DataTypes.INTEGER, allowNull: true },
    submissionId: { type: DataTypes.INTEGER, allowNull: true },
    spinHistoryId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'coin_transactions',
    timestamps: true,
    indexes: [
      { fields: ['userId', 'createdAt'] },
      { fields: ['kind', 'createdAt'] },
      { fields: ['challengeId'] },
    ],
  }
);

export default CoinTransaction;
