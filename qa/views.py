from django.shortcuts import render, get_object_or_404, redirect
from .models import Question, Answer


def question_list(request):
    questions = Question.objects.all()
    return render(request, 'qa/question_list.html', {'questions': questions})


def question_detail(request, pk):
    question = get_object_or_404(Question, pk=pk)
    if request.method == 'POST':
        content = request.POST.get('content', '').strip()
        if content:
            Answer.objects.create(question=question, content=content)
        return redirect('question_detail', pk=pk)
    return render(request, 'qa/question_detail.html', {'question': question})


def ask_question(request):
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '').strip()
        if title and content:
            Question.objects.create(title=title, content=content)
            return redirect('question_list')
    return render(request, 'qa/ask_question.html')
