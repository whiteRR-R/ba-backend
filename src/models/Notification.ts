import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type NotificationType =
    | 'new_vote'          // кто-то оценил твой сабмишен
    | 'vote_updated'      // кто-то изменил оценку
    | 'new_participant'   // новый участник в твоём челлендже
    | 'challenge_started' // челлендж перешёл в active
    | 'challenge_ended'   // челлендж завершён, призы распределены
    | 'new_bet'           // на тебя сделали ставку
    | 'bet_joined'        // кто-то принял твою ставку
    | 'family_invite'     // приглашение в семью (уже было, для единого хранилища)
    | 'challenge_invite'; // приглашение в челлендж (уже было)

interface NotificationAttributes {
    id: number;
    userId: number;           // кому уведомление
    type: NotificationType;
    title: string;
    body: string;
    data?: string;            // JSON string с доп. данными (challengeId, submissionId и т.д.)
    isRead: boolean;
}

interface NotificationCreationAttributes
    extends Optional<NotificationAttributes, 'id' | 'data' | 'isRead'> { }

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes>
    implements NotificationAttributes {
    public id!: number;
    public userId!: number;
    public type!: NotificationType;
    public title!: string;
    public body!: string;
    public data?: string;
    public isRead!: boolean;
    public readonly createdAt!: Date;
}

Notification.init(
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        type: {
            type: DataTypes.ENUM(
                'new_vote', 'vote_updated', 'new_participant',
                'challenge_started', 'challenge_ended',
                'new_bet', 'bet_joined',
                'family_invite', 'challenge_invite'
            ),
            allowNull: false,
        },
        title: { type: DataTypes.STRING(200), allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: false },
        data: { type: DataTypes.TEXT, allowNull: true },
        isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, tableName: 'notifications', timestamps: true }
);

export default Notification;