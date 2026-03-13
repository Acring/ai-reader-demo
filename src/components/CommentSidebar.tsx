import type { Comment } from '../types';

interface CommentSidebarProps {
  comments: Comment[];
  activeCommentId: string | null;
  onActiveChange: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function CommentSidebar({
  comments,
  activeCommentId,
  onActiveChange,
  onDelete,
}: CommentSidebarProps) {
  if (comments.length === 0) {
    return (
      <div className="comment-sidebar empty">
        <p>暂无批注</p>
        <p className="hint">选中文字后可添加高亮或批注</p>
      </div>
    );
  }

  return (
    <div className="comment-sidebar">
      <div className="sidebar-title">批注 ({comments.length})</div>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`comment-card ${activeCommentId === comment.id ? 'active' : ''}`}
          onClick={() => onActiveChange(activeCommentId === comment.id ? null : comment.id)}
        >
          <div className="comment-quote">"{comment.selectedText}"</div>
          <div className="comment-content">{comment.content}</div>
          <div className="comment-actions">
            <button
              className="comment-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(comment.id);
              }}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
