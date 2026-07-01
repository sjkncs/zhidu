// @zhidu/db — 数据查询层（Repository）
// Barrel re-export: 按领域拆分的查询函数统一从此处导出，保持向后兼容
//
// 领域模块：
//   repos/universities     — 院校 & 专业
//   repos/admissions       — 录取分数线
//   repos/plans            — 志愿方案 & 测评
//   repos/profile-knowledge— 用户画像 & 知识库
//   repos/career           — 职业路径 & 目标
//   repos/skills           — 技能树 & 技能节点
//   repos/productivity     — 日程、番茄钟、待办
//   repos/content          — 日记、备忘、简历
//   repos/experience       — 实习 & 科研
//   repos/finance          — 收支记录
//   repos/academics        — 课程、学期、学业统计
//   repos/chat             — 对话会话 & 消息
//   repos/notifications    — 通知

export {
  searchUniversities,
  getUniversityById,
  getUniversitiesByIds,
  searchMajors,
  getMajorById,
  getMajorsByCategory,
} from './repos/universities';

export {
  getAdmissionScores,
  getAdmissionScoreRange,
  findCandidatesByScore,
} from './repos/admissions';

export {
  createPlan,
  getPlanById,
  getUserPlans,
  addPlanItems,
  getPlanItems,
  deletePlanItem,
  updatePlanStatus,
  saveAssessment,
  getUserAssessments,
  getLatestAssessment,
} from './repos/plans';

export {
  getUserProfile,
  updateUserProfile,
  searchKnowledgeDocuments,
  searchKnowledgeChunks,
  getKnowledgeDocuments,
  getKnowledgeChunks,
} from './repos/profile-knowledge';

export {
  createCareerPath,
  getUserCareerPaths,
  deleteCareerPath,
  createGoal,
  getUserGoals,
  updateGoal,
  deleteGoal,
  batchCreateGoals,
} from './repos/career';

export {
  createSkillTree,
  getUserSkillTrees,
  getSkillTreeById,
  updateSkillTree,
  deleteSkillTree,
  createSkillNode,
  getSkillNodes,
  updateSkillNode,
  deleteSkillNode,
  batchCreateSkillNodes,
} from './repos/skills';

export {
  createScheduleEvent,
  getUserScheduleEvents,
  updateScheduleEvent,
  deleteScheduleEvent,
  createPomodoroSession,
  getUserPomodoroSessions,
  updatePomodoroSession,
  createTodo,
  getUserTodos,
  updateTodo,
  deleteTodo,
} from './repos/productivity';

export {
  createDiaryEntry,
  getUserDiaryEntries,
  updateDiaryEntry,
  deleteDiaryEntry,
  createMemo,
  getUserMemos,
  updateMemo,
  deleteMemo,
  createResume,
  getUserResumes,
  getResumeById,
  updateResume,
  deleteResume,
} from './repos/content';

export {
  createInternship,
  getUserInternships,
  updateInternship,
  deleteInternship,
  createResearchProject,
  getUserResearchProjects,
  updateResearchProject,
  deleteResearchProject,
} from './repos/experience';

export {
  createTransaction,
  getUserTransactions,
  updateTransaction,
  deleteTransaction,
} from './repos/finance';

export {
  createCourse,
  getUserCourses,
  updateCourse,
  deleteCourse,
  createSemester,
  getUserSemesters,
  getCurrentSemester,
  updateSemester,
  deleteSemester,
  getAcademicSummary,
  getGpaBySemester,
  getCourseCategoryStats,
} from './repos/academics';

export {
  createChatSession,
  getUserChatSessions,
  deleteChatSession,
  updateChatSessionTitle,
  createChatMessage,
  getSessionMessages,
  batchCreateChatMessages,
} from './repos/chat';

export {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} from './repos/notifications';
