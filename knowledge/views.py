from django.shortcuts import render, get_object_or_404, redirect
from .models import Article, Grade, Subject


def article_list(request):
    articles = Article.objects.all()
    selected_grade = request.GET.get('grade')
    selected_subject = request.GET.get('subject')

    if selected_grade:
        articles = articles.filter(grade_id=selected_grade)
    if selected_subject:
        articles = articles.filter(subject_id=selected_subject)

    grades = Grade.objects.all()
    subjects = Subject.objects.all()

    return render(request, 'knowledge/article_list.html', {
        'articles': articles,
        'grades': grades,
        'subjects': subjects,
        'selected_grade': int(selected_grade) if selected_grade else None,
        'selected_subject': int(selected_subject) if selected_subject else None,
    })


def article_detail(request, pk):
    article = get_object_or_404(Article, pk=pk)
    return render(request, 'knowledge/article_detail.html', {'article': article})


def create_article(request):
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '').strip()
        grade_id = request.POST.get('grade')
        subject_id = request.POST.get('subject')
        author_name = request.POST.get('author_name', '').strip()

        if title and content and grade_id and subject_id:
            Article.objects.create(
                title=title,
                content=content,
                grade_id=grade_id,
                subject_id=subject_id,
                author_name=author_name,
            )
            return redirect('article_list')

    grades = Grade.objects.all()
    subjects = Subject.objects.all()
    return render(request, 'knowledge/create_article.html', {
        'grades': grades,
        'subjects': subjects,
    })
